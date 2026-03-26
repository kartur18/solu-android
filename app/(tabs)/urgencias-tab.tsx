import { useRouter } from 'expo-router'
import { useEffect } from 'react'

export default function SoporteTab() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/soporte')
  }, [])
  return null
}
