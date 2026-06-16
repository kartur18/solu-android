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
  // Las URLs de Supabase Storage son FIRMADAS (/object/sign/...?token=...) y
  // el bucket es privado. El proxy Cloudinary /image/fetch devolvía 401 (su
  // fetch remoto está restringido y, además, el ?token firmado se perdía al
  // concatenarlo), así que las fotos NO cargaban. La URL firmada de Supabase
  // ya sirve la imagen directo (200), así que la devolvemos tal cual.
  // (Optimización de tamaño pendiente: usar render/image de Supabase.)
  if (url.includes('supabase.co')) {
    return url
  }
  return url
}
