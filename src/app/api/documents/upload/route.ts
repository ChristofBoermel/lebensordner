
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserTier, requireFeature } from '@/lib/auth/tier-guard'
import { canUploadFile } from '@/lib/subscription-tiers'
import { NextRequest, NextResponse } from 'next/server'

// New endpoint for secure server-side uploads
export async function POST(req: NextRequest) {
    const supabase = await createServerSupabaseClient()

    // 1. Auth Check (handled by tier-guard + basic check here)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const path = formData.get('path') as string // folder path e.g. 'identitaet/ausweis'
        const bucket = formData.get('bucket') as string || 'documents'

        if (!file || !path) {
            return NextResponse.json({ error: 'Keine Datei oder Pfad angegeben' }, { status: 400 })
        }

        // Validate Bucket
        const ALLOWED_BUCKETS = ['documents', 'avatars']
        if (!ALLOWED_BUCKETS.includes(bucket)) {
            return NextResponse.json({ error: 'Ungültiger Storage Bucket' }, { status: 400 })
        }

        // 2. Validate File Type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] // Added webp for avatars
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({
                error: 'Ungültiges Format. Erlaubt sind PDF, JPG, PNG und WebP.'
            }, { status: 400 })
        }

        // 3. Validate File Size (Hard Limit: 25MB)
        const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
                error: 'Datei ist zu groß (Maximal 25 MB).'
            }, { status: 400 })
        }

        // 4. Get User Tier & Current Storage
        const tier = await getUserTier()
        const { data: profile } = await supabase
            .from('profiles')
            .select('storage_used')
            .eq('id', user.id)
            .single()

        const currentStorageMB = (profile?.storage_used || 0) / (1024 * 1024)
        const fileSizeMB = file.size / (1024 * 1024)

        // 5. Check Storage Limit
        const storageCheck = canUploadFile(tier, currentStorageMB, fileSizeMB)
        if (!storageCheck.allowed) {
            return NextResponse.json({ error: storageCheck.reason }, { status: 403 })
        }

        // 6. Upload to Supabase Storage (Server-Side)
        // We upload to the user's private folder: {user_id}/{path}/{timestamp}_{filename}
        const timestamp = Date.now()
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        // For avatars, path might be just user ID, but we enforce user isolation
        // If bucket is avatars, path is usually just the filename or simpler structure.
        // We trust 'path' passed from client but ensure it starts with user.id or we prepend it?
        // Current client logic:
        // Documents: `${user.id}/${Date.now()}.${fileExt}`
        // Avatars: `${user.id}/${Date.now()}.${fileExt}`
        // Client passes `path` which effectively corresponds to the full path relative to bucket root?
        // Wait, client passes 'path' in formData.
        // In my previous code: `const fullPath = `${user.id}/${path}/${timestamp}_${safeFilename}``
        // This forcibly structured it.
        // Clients might expect to control the path more.
        // Let's adjust:
        // If client provides 'path' meant to be the full path, we should validate it starts with user.id.
        // OR we stick to the imposed structure.

        // DECISION: To support existing client logic which generates formatted paths:
        // We should accept 'fullPath' if possible, OR we reconstruct it.
        // Existing client logic generates: `${user.id}/${Date.now()}.${fileExt}`.
        // If I force `${user.id}/${path}/${timestamp}...` it changes the structure.

        // Improved Logic:
        // Client sends 'path' which effectively serves as the "folder" or "usage context".
        // But to match client expectation of file location?
        // Actually, client uses the returned `path` (or constructs it).
        // If I change the path structure, I must return it to the client.

        // Let's stick to the secure enforced path: `${user.id}/${path}/${timestamp}_${safeFilename}`
        // Client currently sends: `const fileName = `${user.id}/${Date.now()}.${fileExt}``
        // If I want to match client exactly, I'd need to let client dictate path (Insecure?).
        // Better: Client sends `path` as just the filename or subdir?
        // Let's treat `path` param as "target directory relative to user root".
        // Example: Client uploads to `documents`. Path param = `identitaet`.
        // Result: `userid/identitaet/timestamp_filename`.

        // For Avatars: Path param = `profile`.
        // Result: `userid/profile/timestamp_filename`.

        // Update: my previous code used `const fullPath = `${user.id}/${path}/${timestamp}_${safeFilename}``
        // This is good. It enforces user isolation.

        const fullPath = `${user.id}/${path}/${timestamp}_${safeFilename}`

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from(bucket) // Use dynamic bucket
            .upload(fullPath, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (uploadError) {
            console.error('Upload Error:', uploadError)
            return NextResponse.json({ error: 'Fehler beim Upload zu Supabase' }, { status: 500 })
        }

        // 7. Update Database: Increment storage_used
        // Note: We do this *after* successful upload.
        // Ideally we would do this in a transaction or use a trigger, but client requirements asked for an API check.
        // For robust 'storage_used' tracking, reliable method depends on implementation.
        // Here we manually increment.

        // Convert file size to integer bytes just in case
        const newStorageUsed = (profile?.storage_used || 0) + file.size

        await supabase.from('profiles').update({
            storage_used: newStorageUsed,
            updated_at: new Date().toISOString()
        }).eq('id', user.id)

        // Success
        return NextResponse.json({
            success: true,
            path: fullPath,
            size: file.size,
            message: 'Upload erfolgreich'
        })

    } catch (error: any) {
        console.error('Server Upload Error:', error)
        return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
    }
}
