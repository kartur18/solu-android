import { ENV } from './env'

// Cloudinary image optimization for Android
const CLOUD_NAME = ENV.CLOUDINARY_CLOUD_NAME

export function optimizeUrl(url: string | null | undefined, opts?: { width?: number; height?: number }): string {
  if (!url) return ''
  // If already a Cloudinary URL, add transforms
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/')
    if (parts.length === 2) {
      const transforms = ['f_auto', 'q_auto']
      if (opts?.width) transforms.push(`w_${opts.width}`)
      if (opts?.height) transforms.push(`h_${opts.height}`)
      return `${parts[0]}/upload/${transforms.join(',')}/${parts[1]}`
    }
  }
  // For Supabase URLs, proxy through Cloudinary fetch
  if (url.includes('supabase.co') && CLOUD_NAME) {
    const transforms = ['f_auto', 'q_auto']
    if (opts?.width) transforms.push(`w_${opts.width}`)
    if (opts?.height) transforms.push(`h_${opts.height}`)
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transforms.join(',')}/${url}`
  }
  return url
}
