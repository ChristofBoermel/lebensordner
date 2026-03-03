export const PROFILE_AVATAR_UPDATED_EVENT = 'profile:avatar-updated'

export type ProfileAvatarUpdatedDetail = {
  path: string | null
}

export function emitProfileAvatarUpdated(path: string | null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ProfileAvatarUpdatedDetail>(PROFILE_AVATAR_UPDATED_EVENT, {
      detail: { path },
    })
  )
}
