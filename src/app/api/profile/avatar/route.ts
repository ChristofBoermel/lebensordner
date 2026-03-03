import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractAvatarStoragePath } from '@/lib/avatar'
import { emitStructuredError } from '@/lib/errors/structured-logger'

function createServiceClient() {
  return createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Keine Datei ausgewählt' }, { status: 400 })
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'Ungültiges Format. Erlaubt sind JPG, PNG und WebP.' }, { status: 400 })
    }

    const maxSizeBytes = 5 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: 'Das Bild darf maximal 5 MB groß sein' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single()

    const previousAvatarPath = extractAvatarStoragePath(profileData?.profile_picture_url)

    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fullPath = `${user.id}/profile/${timestamp}_${safeFilename}`

    const { error: uploadError } = await serviceClient.storage
      .from('avatars')
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Avatar upload failed: ${uploadError.message}`,
        endpoint: '/api/profile/avatar',
      })
      return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
    }

    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ profile_picture_url: fullPath })
      .eq('id', user.id)

    if (updateError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Avatar profile update failed: ${updateError.message}`,
        endpoint: '/api/profile/avatar',
      })

      await serviceClient.storage.from('avatars').remove([fullPath])
      return NextResponse.json({ error: 'Profilbild konnte nicht gespeichert werden' }, { status: 500 })
    }

    if (previousAvatarPath && previousAvatarPath !== fullPath) {
      const { error: cleanupError } = await serviceClient.storage
        .from('avatars')
        .remove([previousAvatarPath])

      if (cleanupError) {
        emitStructuredError({
          error_type: 'api',
          error_message: `Avatar cleanup failed: ${cleanupError.message}`,
          endpoint: '/api/profile/avatar',
        })
      }
    }

    return NextResponse.json({
      success: true,
      path: fullPath,
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Unexpected avatar upload error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/profile/avatar',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const { data: profileData, error: profileLoadError } = await supabase
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single()

    if (profileLoadError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Failed to load profile avatar: ${profileLoadError.message}`,
        endpoint: '/api/profile/avatar',
      })
      return NextResponse.json(
        { error: 'Profilbild konnte nicht geladen werden' },
        { status: 500 }
      )
    }

    const avatarPath = extractAvatarStoragePath(profileData?.profile_picture_url)
    let storageDeleted = false

    if (avatarPath) {
      const serviceClient = createServiceClient()
      const { error: storageDeleteError } = await serviceClient.storage
        .from('avatars')
        .remove([avatarPath])

      if (storageDeleteError) {
        emitStructuredError({
          error_type: 'api',
          error_message: `Failed to delete avatar object: ${storageDeleteError.message}`,
          endpoint: '/api/profile/avatar',
        })
      } else {
        storageDeleted = true
      }
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ profile_picture_url: null })
      .eq('id', user.id)

    if (profileUpdateError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Failed to clear profile avatar URL: ${profileUpdateError.message}`,
        endpoint: '/api/profile/avatar',
      })
      return NextResponse.json(
        { error: 'Profilbild konnte nicht entfernt werden' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      storageDeleted,
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Unexpected avatar delete error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/profile/avatar',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Profilbild konnte nicht entfernt werden' },
      { status: 500 }
    )
  }
}
