
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/auth/tier-guard'
import { canUploadFile } from '@/lib/subscription-tiers'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, incrementRateLimit, RATE_LIMIT_UPLOAD } from '@/lib/security/rate-limit'
import { CATEGORY_METADATA_FIELDS, type DocumentCategory } from '@/types/database'

// New endpoint for secure server-side uploads
export async function POST(req: NextRequest) {
    const supabase = await createServerSupabaseClient()

    // 1. Auth Check (handled by tier-guard + basic check here)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Extract client IP
    const forwarded = req.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    // IP-based rate limiting
    const ipRateLimitConfig = {
        identifier: `upload_ip:${clientIp}`,
        endpoint: '/api/documents/upload',
        ...RATE_LIMIT_UPLOAD,
    }

    const ipRateLimit = await checkRateLimit(ipRateLimitConfig)
    if (!ipRateLimit.allowed) {
        const retryAfterSeconds = Math.ceil(
            (ipRateLimit.resetAt.getTime() - Date.now()) / 1000
        )
        return NextResponse.json(
            { error: 'Too many requests', retryAfterSeconds },
            { status: 429 }
        )
    }

    // Per-user rate limiting
    const rateLimitConfig = {
        identifier: `upload:${user.id}`,
        endpoint: '/api/documents/upload',
        ...RATE_LIMIT_UPLOAD,
    }

    const rateLimit = await checkRateLimit(rateLimitConfig)
    if (!rateLimit.allowed) {
        const retryAfterSeconds = Math.ceil(
            (rateLimit.resetAt.getTime() - Date.now()) / 1000
        )
        return NextResponse.json(
            { error: 'Too many requests', retryAfterSeconds },
            { status: 429 }
        )
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const path = formData.get('path') as string // folder path e.g. 'identitaet/ausweis'
        const bucket = (formData.get('bucket') as string) || 'documents'
        const reminderWatcherIdRaw = formData.get('reminder_watcher_id') as string | null
        const reminderWatcherId =
            reminderWatcherIdRaw && reminderWatcherIdRaw.trim().length > 0
                ? reminderWatcherIdRaw
                : null

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

        if (reminderWatcherId && !tier.limits.familyDashboard) {
            return NextResponse.json(
                { error: 'Diese Funktion ist nur für Basic- und Premium-Nutzer verfügbar' },
                { status: 403 }
            )
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

        let insertedDocument: unknown = null

        if (bucket === 'documents') {
            const category = (formData.get('category') as string) || null
            const subcategoryId = (formData.get('subcategory_id') as string) || null
            const customCategoryId = (formData.get('custom_category_id') as string) || null
            const title = (formData.get('title') as string) || ''
            const notes = (formData.get('notes') as string) || null
            const expiryDate = (formData.get('expiry_date') as string) || null
            const customReminderDaysRaw = (formData.get('custom_reminder_days') as string) || null
            const fileName = (formData.get('file_name') as string) || file.name
            const fileType = (formData.get('file_type') as string) || file.type || 'application/octet-stream'

            const customReminderDays = customReminderDaysRaw
                ? Number(customReminderDaysRaw)
                : null

            if (!category || !title.trim()) {
                return NextResponse.json(
                    { error: 'Fehlende Dokument-Metadaten' },
                    { status: 400 }
                )
            }

            if (customReminderDaysRaw && Number.isNaN(customReminderDays)) {
                return NextResponse.json(
                    { error: 'Ungültige Erinnerungsoption' },
                    { status: 400 }
                )
            }

            // Parse and validate category-specific metadata
            const metadataRaw = formData.get('metadata') as string | null
            let parsedMetadata: Record<string, string> | null = null

            const metadataFields = CATEGORY_METADATA_FIELDS[category as DocumentCategory]
            if (metadataFields && metadataFields.length > 0) {
                if (metadataRaw) {
                    try {
                        parsedMetadata = JSON.parse(metadataRaw)
                    } catch {
                        return NextResponse.json(
                            { error: 'Ungültiges Metadaten-Format' },
                            { status: 400 }
                        )
                    }
                }

                // Validate required fields
                const requiredFields = metadataFields.filter(f => f.required)
                const missingFields = requiredFields.filter(
                    f => !parsedMetadata || !parsedMetadata[f.name] || parsedMetadata[f.name].trim() === ''
                )
                if (missingFields.length > 0) {
                    return NextResponse.json(
                        { error: `Pflichtfelder fehlen: ${missingFields.map(f => f.label).join(', ')}` },
                        { status: 400 }
                    )
                }
            } else if (metadataRaw) {
                // Category has no defined fields but metadata was sent - parse it anyway
                try {
                    parsedMetadata = JSON.parse(metadataRaw)
                } catch {
                    // Ignore invalid metadata for categories without defined fields
                }
            }

            const { data: documentData, error: documentError } = await supabase
                .from('documents')
                .insert({
                    user_id: user.id,
                    category,
                    subcategory_id: subcategoryId || null,
                    custom_category_id: customCategoryId || null,
                    title: title.trim(),
                    notes: notes && notes.trim().length > 0 ? notes : null,
                    file_name: fileName,
                    file_path: fullPath,
                    file_size: file.size,
                    file_type: fileType,
                    expiry_date: expiryDate || null,
                    custom_reminder_days: customReminderDays,
                    reminder_watcher_id: reminderWatcherId,
                    metadata: parsedMetadata,
                })
                .select()
                .single()

            if (documentError) {
                console.error('Document Insert Error:', documentError)
                return NextResponse.json(
                    { error: 'Fehler beim Speichern des Dokuments' },
                    { status: 500 }
                )
            }

            insertedDocument = documentData
        }

        await incrementRateLimit(rateLimitConfig)
        await incrementRateLimit(ipRateLimitConfig)

        // Success
        return NextResponse.json({
            success: true,
            path: fullPath,
            size: file.size,
            document: insertedDocument,
            message: 'Upload erfolgreich'
        })

    } catch (error: any) {
        console.error('Server Upload Error:', error)
        return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
    }
}
