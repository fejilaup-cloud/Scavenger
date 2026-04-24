import { useState, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { uploadToIPFS } from '@/lib/ipfs'

export const MAX_IMAGES = 5
export const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface ImageFile {
  id: string
  file: File
  preview: string
  /** 0-100 while uploading, 100 when done */
  progress: number
  cid?: string
  error?: string
}

export interface UseImageUploadReturn {
  images: ImageFile[]
  addImages: (files: File[]) => Promise<void>
  removeImage: (id: string) => void
  cids: string[]
  isUploading: boolean
  validationError: string | null
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: unsupported format (JPEG, PNG, WebP, GIF only)`
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `${file.name}: exceeds ${MAX_SIZE_MB} MB limit`
  return null
}

export function useImageUpload(): UseImageUploadReturn {
  const [images, setImages] = useState<ImageFile[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const addImages = useCallback(async (files: File[]) => {
    setValidationError(null)

    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      setValidationError(`Maximum ${MAX_IMAGES} images allowed.`)
      return
    }

    const toProcess = files.slice(0, remaining)

    for (const file of toProcess) {
      const err = validateFile(file)
      if (err) { setValidationError(err); return }
    }

    // Create preview entries immediately
    const newEntries: ImageFile[] = toProcess.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }))

    setImages((prev) => [...prev, ...newEntries])

    // Compress + upload each
    for (const entry of newEntries) {
      try {
        const compressed = await imageCompression(entry.file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })

        const cid = await uploadToIPFS(compressed, (pct) => {
          setImages((prev) =>
            prev.map((img) => (img.id === entry.id ? { ...img, progress: pct } : img))
          )
        })

        setImages((prev) =>
          prev.map((img) =>
            img.id === entry.id ? { ...img, cid, progress: 100 } : img
          )
        )
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Upload failed'
        setImages((prev) =>
          prev.map((img) => (img.id === entry.id ? { ...img, error, progress: 0 } : img))
        )
      }
    }
  }, [images.length])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) URL.revokeObjectURL(img.preview)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const cids = images.filter((i) => i.cid).map((i) => i.cid!)
  const isUploading = images.some((i) => i.progress > 0 && i.progress < 100 && !i.error)

  return { images, addImages, removeImage, cids, isUploading, validationError }
}
