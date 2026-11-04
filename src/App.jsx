import { Fragment, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Gift,
  Heart,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

const MAX_PHOTOS = 10
const MAX_MESSAGE_LENGTH = 220
const PREVIEW_QUOTES = [
  'The best days are the ones we get to share.',
  'Some moments find a forever home in our hearts.',
  'You make the ordinary feel like magic.',
  'A little love lives in every memory.',
]
const STORAGE_BUCKET = 'gift-photos'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL
let supabasePromise

async function saveGift(gift) {
  const supabase = await getSupabase()

  const photoPaths = []
  for (const [index, photo] of gift.photos.entries()) {
    const path = `${gift.id}/${index + 1}.jpg`
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, photo.blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
    if (error) throw new Error(`Could not upload ${photo.name}: ${error.message}`)
    photoPaths.push(path)
  }

  const { error } = await supabase.from('gifts').insert({
    id: gift.id,
    message: gift.message,
    photo_paths: photoPaths,
  })
  if (error) throw new Error(`Could not save your gift: ${error.message}`)
}

async function loadGift(id) {
  const supabase = await getSupabase()

  const { data, error } = await supabase.rpc('get_gift', { gift_id: id })
  if (error) throw new Error(`This gift could not be opened: ${error.message}`)
  const record = data?.[0]
  if (!record) return null

  return {
    ...record,
    photos: record.photo_paths.map((path) => ({
      name: path.split('/').pop(),
      url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl,
    })),
  }
}

async function loadAdminPhotos(supabase) {
  const { data, error } = await supabase.rpc('get_admin_gifts')
  if (error) throw new Error(`Could not load the admin gallery: ${error.message}`)

  return (data ?? []).flatMap((gift) => gift.photo_paths.map((path) => ({
    path,
    createdAt: gift.created_at,
    url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl,
  })))
}

async function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Remote sharing is not configured. Add the Supabase URL and public anon key to .env.local.')
  }

  if (!supabasePromise) {
    supabasePromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey))
  }
  return supabasePromise
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const source = URL.createObjectURL(file)

    image.onload = () => {
      const maxDimension = 1600
      const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))

      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(source)
        reject(new Error(`Could not prepare ${file.name} for your gift.`))
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(source)
          if (blob) resolve({ blob, name: file.name })
          else reject(new Error(`Could not compress ${file.name}. Please choose another photo.`))
        },
        'image/jpeg',
        0.8,
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error(`${file.name} could not be read as an image.`))
    }
    image.src = source
  })
}

function getShareTarget() {
  const configuredUrl = publicAppUrl?.trim()
  const value = configuredUrl || window.location.origin
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('VITE_PUBLIC_APP_URL must be a complete public URL, such as https://your-app.example.com.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VITE_PUBLIC_APP_URL must start with http:// or https://.')
  }

  return {
    baseUrl: url.origin,
    requiresDeployment: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
  }
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return path
}

function App() {
  const path = useRoute()
  const giftMatch = path.match(/^\/gift\/([^/]+)\/?$/)

  return (
    <main className="app-shell min-h-screen bg-[#faf9f6] text-[#292721]">
      {giftMatch ? (
        <GiftPage giftId={decodeURIComponent(giftMatch[1])} />
      ) : /^\/admin\/?$/.test(path) ? (
        <AdminPage />
      ) : (
        <CreatorPage />
      )}
    </main>
  )
}

function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? 'brand-compact' : ''}`} href="/" aria-label="Little Keepsake home">
      <span className="brand-mark"><Gift size={17} strokeWidth={1.8} /></span>
      <span>little keepsake</span>
    </a>
  )
}

function Header() {
  return (
    <header className="site-header">
      <Brand />
      <div className="header-actions">
        <div className="header-note"><LockKeyhole size={13} /> A little place for your memories</div>
        <a className="admin-link" href="/admin">Admin gallery</a>
      </div>
    </header>
  )
}

function KeepsakeDoll({ outfit = 'lilac' }) {
  const dress = outfit === 'peach' ? '#e7b6a5' : '#c9b8cf'
  const bow = outfit === 'peach' ? '#c88f83' : '#a58caf'

  return (
    <svg className="keepsake-doll" viewBox="0 0 82 100" role="img" aria-label="A cute little keepsake doll">
      <ellipse cx="41" cy="94" rx="25" ry="4" fill="#d8d0c8" opacity=".55" />
      <path d="M25 51c-7 5-10 15-9 24l9 1 4-18m28-7c7 5 10 15 9 24l-9 1-4-18" fill="#e9c2ad" stroke="#9b796f" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 56c3-7 27-7 30 0l8 29c-12 8-34 8-46 0z" fill={dress} stroke="#8d7a8e" strokeWidth="1.5" />
      <path d="M34 59c3 4 11 4 14 0m-16 13h18m-21 7h24" fill="none" stroke="#f8f2ed" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 85l-2 7m20-7 2 7" fill="none" stroke="#9b796f" strokeWidth="3" strokeLinecap="round" />
      <path d="M27 29c0-14 8-22 18-21 10 1 15 10 13 24l-5 19H31z" fill="#755e58" />
      <ellipse cx="41" cy="34" rx="17" ry="19" fill="#f3d4bd" stroke="#9b796f" strokeWidth="1.5" />
      <path d="M25 31c2-15 12-24 23-19 6 2 9 8 10 14-7-2-12-6-15-11-3 7-9 12-18 16" fill="#755e58" />
      <circle cx="35" cy="35" r="1.6" fill="#473d3a" />
      <circle cx="47" cy="35" r="1.6" fill="#473d3a" />
      <path d="M38 42c2 2 5 2 7 0" fill="none" stroke="#a16f70" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="31" cy="40" r="3" fill="#e9aaa2" opacity=".7" />
      <circle cx="51" cy="40" r="3" fill="#e9aaa2" opacity=".7" />
      <path d="M54 19l7-6m-4 12 9-1m-15-7 1-8" stroke={bow} strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="13" r="4" fill={bow} />
      <path d="M41 65c-5-5-10 2 0 8 10-6 5-13 0-8" fill="#fff5f0" />
    </svg>
  )
}

function CreatorPage() {
  const [photos, setPhotos] = useState([])
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdGift, setCreatedGift] = useState(null)
  const [copyState, setCopyState] = useState('idle')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const fileInputRef = useRef(null)
  const previewScrollRef = useRef(null)
  const previewUrls = useRef(new Set())

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }, [])

  useEffect(() => {
    if (!isPreviewOpen) return undefined

    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsPreviewOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isPreviewOpen])

  function addPhotos(fileList) {
    const files = Array.from(fileList ?? [])
    if (!files.length) return

    const remaining = MAX_PHOTOS - photos.length
    const eligible = files.filter((file) => file.type.startsWith('image/'))
    if (eligible.length !== files.length) setError('Please choose image files only.')
    else setError('')

    if (eligible.length > remaining) {
      setError(`You can add up to ${MAX_PHOTOS} photos. We added the first ${remaining}.`)
    }

    const additions = eligible.slice(0, Math.max(0, remaining)).map((file) => {
      const preview = URL.createObjectURL(file)
      previewUrls.current.add(preview)
      return {
        file,
        preview,
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
      }
    })
    setPhotos((current) => [...current, ...additions])
  }

  function removePhoto(id) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id)
      if (photo) {
        URL.revokeObjectURL(photo.preview)
        previewUrls.current.delete(photo.preview)
      }
      return current.filter((item) => item.id !== id)
    })
    setError('')
  }

  async function createGift(event) {
    event.preventDefault()
    setError('')
    if (!photos.length) {
      setError('Add at least one photo to make your gift.')
      return
    }

    let shareTarget
    try {
      shareTarget = getShareTarget()
    } catch (targetError) {
      setError(targetError instanceof Error ? targetError.message : 'The public app URL is not valid.')
      return
    }

    setIsCreating(true)
    try {
      const compressedPhotos = await Promise.all(photos.map(({ file }) => compressImage(file)))
      const id = crypto.randomUUID()
      const gift = {
        id,
        message: message.trim(),
        photos: compressedPhotos,
        createdAt: Date.now(),
      }
      await saveGift(gift)
      setCreatedGift({ id, url: `${shareTarget.baseUrl}/gift/${id}`, requiresDeployment: shareTarget.requiresDeployment })
      setCopyState('idle')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Something went wrong while creating your gift.')
    } finally {
      setIsCreating(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(createdGift.url)
      setCopyState('copied')
    } catch {
      setCopyState('unavailable')
    }
  }

  function resetCreator() {
    setCreatedGift(null)
    photos.forEach((photo) => {
      URL.revokeObjectURL(photo.preview)
      previewUrls.current.delete(photo.preview)
    })
    setPhotos([])
    setMessage('')
    setError('')
  }

  return (
    <>
      <Header />
      <div className="creator-layout">
        <section className="creator-main">
          <motion.div
            className="intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <div className="eyebrow"><Sparkles size={14} /> A gift made of moments</div>
            <h1>Some things are<br />better <span>kept together.</span></h1>
            <p className="intro-copy">Gather your favorite photos and send someone a little reminder of how much they mean to you.</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {createdGift ? (
              <SuccessCard
                key="success"
                gift={createdGift}
                copyState={copyState}
                onCopy={copyLink}
                onReset={resetCreator}
              />
            ) : (
              <motion.form
                key="form"
                className="gift-form"
                onSubmit={createGift}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="form-section">
                  <div className="section-heading">
                    <span className="step-number">01</span>
                    <div><h2>Choose your photos</h2><p>A few favorites, up to ten.</p></div>
                    <span className="photo-count">{photos.length} / {MAX_PHOTOS}</span>
                  </div>

                  <div
                    className={`drop-zone ${isDragging ? 'is-dragging' : ''} ${photos.length ? 'has-photos' : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      setIsDragging(false)
                      addPhotos(event.dataTransfer.files)
                    }}
                  >
                    {photos.length ? (
                      <div className="photo-grid">
                        {photos.map((photo) => (
                          <motion.div className="photo-thumb" key={photo.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                            <img src={photo.preview} alt={photo.file.name} />
                            <button type="button" className="remove-photo" onClick={() => removePhoto(photo.id)} aria-label={`Remove ${photo.file.name}`}>
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        ))}
                        {photos.length < MAX_PHOTOS && (
                          <button type="button" className="add-more" onClick={() => fileInputRef.current?.click()} aria-label="Add more photos">
                            <Plus size={20} /><span>Add more</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button type="button" className="empty-drop" onClick={() => fileInputRef.current?.click()}>
                        <span className="upload-icon"><ImagePlus size={21} strokeWidth={1.6} /></span>
                        <strong>Drop your photos here</strong>
                        <span>or <span className="text-link">browse files</span> from your device</span>
                        <span className="file-hint">JPG, PNG or WebP · up to 10 photos</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        addPhotos(event.target.files)
                        event.target.value = ''
                      }}
                    />
                  </div>
                </div>

                <div className="form-section message-section">
                  <div className="section-heading">
                    <span className="step-number">02</span>
                    <div><h2>Add a little note</h2><p>The words that make it yours.</p></div>
                  </div>
                  <label className="message-box">
                    <span className="visually-hidden">Your personal message</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                      placeholder="Happy birthday! Here's to all our little adventures..."
                      maxLength={MAX_MESSAGE_LENGTH}
                      rows={3}
                    />
                    <span className="character-count">{message.length} / {MAX_MESSAGE_LENGTH}</span>
                  </label>
                </div>

                {error && <div className="error-message" role="alert">{error}</div>}

                <button
                  className="preview-form-button"
                  type="button"
                  disabled={photos.length === 0}
                  onClick={() => setIsPreviewOpen(true)}
                >
                  Preview your gift <ImagePlus size={15} />
                </button>
                <button className="create-button" type="submit" disabled={isCreating || photos.length === 0}>
                  {isCreating ? <><LoaderCircle className="spin" size={17} /> Making your gift...</> : <>Create your gift <ArrowRight size={17} /></>}
                </button>
                <p className="privacy-note"><LockKeyhole size={12} /> Anyone with your gift link can view its photos.</p>
              </motion.form>
            )}
          </AnimatePresence>
        </section>

        <aside className="preview-side" aria-label="Gift hamper preview">
          <div className="preview-orbit orbit-one" />
          <div className="preview-orbit orbit-two" />
          <motion.div
            className="preview-card"
            initial={{ opacity: 0, y: 22, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.18, duration: 0.7 }}
          >
            <div className="preview-topline"><span>JUST FOR YOU</span><Heart size={15} /></div>
            <div className="preview-art">
              <div className="preview-flower flower-a">✿</div>
              <div className="preview-flower flower-b">✿</div>
              <div className="preview-sun" />
              <div className="preview-hill hill-back" />
              <div className="preview-hill hill-front" />
              <div className="preview-postmark">WITH<br />LOVE</div>
            </div>
            <div className="preview-card-note">
              <span>A tiny collection of</span>
              <strong>our favorite days</strong>
              <div className="preview-dashes"><span /><span /><span /></div>
            </div>
          </motion.div>
          <motion.div className="floating-note note-top" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }}>
            <span className="note-dot" /> made with love
          </motion.div>
          <motion.div className="floating-note note-bottom" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
            <Heart size={14} fill="currentColor" /> memories, wrapped up
          </motion.div>
          <div className="preview-caption"><span>01</span><span className="caption-line" /> A little love, sent your way</div>
        </aside>
      </div>
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div
            className="gift-preview-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsPreviewOpen(false)
            }}
          >
            <motion.section
              className="gift-preview-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gift-preview-title"
              initial={{ opacity: 0, y: 14, scale: .98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: .99 }}
            >
              <div className="gift-preview-header">
                <div>
                  <span className="eyebrow"><Heart size={13} /> A LITTLE SNEAK PEEK</span>
                  <h2 id="gift-preview-title">Your gift, all together.</h2>
                </div>
                <button className="preview-close" type="button" onClick={() => setIsPreviewOpen(false)} aria-label="Close preview"><X size={18} /></button>
              </div>
              <div className="gift-preview-content" ref={previewScrollRef}>
                <div className="preview-heart-overlay" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <motion.span
                      className="preview-flying-heart"
                      key={index}
                      initial={{ y: 0, x: 0, opacity: 0 }}
                      animate={{ y: -430, x: index % 2 ? 24 : -24, opacity: [0, .8, .8, 0] }}
                      transition={{ duration: 5.2 + (index % 4) * .8, delay: index * .7, repeat: Infinity, ease: 'easeOut' }}
                      style={{ '--heart-left': `${8 + ((index * 37) % 84)}%` }}
                    >
                      <Heart size={12 + (index % 3) * 4} fill="currentColor" />
                    </motion.span>
                  ))}
                </div>
                <div className="gift-preview-message">{message.trim() || 'A little reminder that you are loved.'}</div>
                <p className="gift-preview-caption">A few moments, saved just for you.</p>
                <motion.div
                  className="preview-doll-note"
                  initial={{ opacity: 0, y: 12, scale: .97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: .55, delay: .12 }}
                >
                  <KeepsakeDoll />
                  <div className="doll-note-copy">
                    <span>A tiny friend says</span>
                    <strong>you are loved, more than you know.</strong>
                    <span className="doll-note-sparkles">✦ &nbsp;♡&nbsp; ✦</span>
                  </div>
                  <KeepsakeDoll outfit="peach" />
                </motion.div>
                <div className="gift-preview-gallery-heading">
                  <span>Your little collection</span>
                  <span>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
                </div>
                <div className="gift-preview-photos">
                  {photos.map((photo, index) => (
                    <Fragment key={photo.id}>
                      <motion.figure
                        className="polaroid"
                        initial={{ opacity: 0, y: 26, rotate: index % 2 === 0 ? -4 : 4, scale: .94 }}
                        whileInView={{ opacity: 1, y: 0, rotate: index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1.5 : 0, scale: 1 }}
                        viewport={{ root: previewScrollRef, once: true, amount: .2 }}
                        transition={{ type: 'spring', stiffness: 150, damping: 18, delay: index * .12 }}
                        style={{ '--photo-index': index }}
                      >
                        <img src={photo.preview} alt={`Gift photo ${index + 1}`} />
                        <figcaption><span>little moment</span><Heart size={12} /></figcaption>
                      </motion.figure>
                      {index < photos.length - 1 && index % 2 === 1 && (
                        <motion.blockquote
                          className={`preview-love-quote quote-${index % 4}`}
                          initial={{ opacity: 0, y: 14, scale: .97 }}
                          whileInView={{ opacity: 1, y: 0, scale: 1 }}
                          viewport={{ root: previewScrollRef, once: true, amount: .2 }}
                          transition={{ duration: .55, delay: .12 }}
                        >
                          <Heart size={14} fill="currentColor" />
                          <span>{PREVIEW_QUOTES[(index - 1) % PREVIEW_QUOTES.length]}</span>
                          <i>— a little love note</i>
                        </motion.blockquote>
                      )}
                    </Fragment>
                  ))}
                </div>
                {photos.length > 2 && <p className="gift-preview-scroll-hint"><ChevronDown size={13} /> Scroll to see every little moment</p>}
              </div>
              <button className="create-button preview-done" type="button" onClick={() => setIsPreviewOpen(false)}>Looks lovely <Check size={16} /></button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="site-footer"><span>Made for the people who make life lovely.</span><span>© little keepsake</span></footer>
    </>
  )
}

function SuccessCard({ gift, copyState, onCopy, onReset }) {
  return (
    <motion.section className="success-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} aria-live="polite">
      <div className="success-icon"><Check size={23} strokeWidth={1.8} /></div>
      <div className="success-kicker">IT'S READY</div>
      <h2>Your little gift is<br /><span>ready to be opened.</span></h2>
      <p>Send this link to someone who makes your days a little brighter. Anyone with the link can open it.</p>
      <div className="share-link">
        <input aria-label="Shareable gift link" readOnly value={gift.url} onFocus={(event) => event.target.select()} />
        <button type="button" onClick={onCopy} aria-label="Copy gift link">
          {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <button className="create-button copy-button" type="button" onClick={onCopy}>
        {copyState === 'copied' ? <>Copied to clipboard <Check size={16} /></> : <>Copy the link <Copy size={16} /></>}
      </button>
      {copyState === 'unavailable' && <p className="copy-help" role="status">Copy isn’t available here. Select the link above to copy it manually.</p>}
      <a className="preview-link" href={`/gift/${gift.id}`}>Open the gift preview <ArrowRight size={15} /></a>
      <p className="privacy-note"><LockKeyhole size={12} /> {gift.requiresDeployment ? 'Deploy the app to a public website before sharing this local link.' : 'Your photos are online and this link opens from any device.'}</p>
      <button className="text-button" type="button" onClick={onReset}>Make another gift</button>
    </motion.section>
  )
}

function AdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [photos, setPhotos] = useState([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const supabase = await getSupabase()
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw new Error(`Could not check your sign-in: ${sessionError.message}`)
        if (!active || !data.session) return

        setEmail(data.session.user.email ?? '')
        setIsAuthenticated(true)
        const adminPhotos = await loadAdminPhotos(supabase)
        if (active) setPhotos(adminPhotos)
      } catch (sessionError) {
        if (active) setError(sessionError instanceof Error ? sessionError.message : 'Could not open the admin gallery.')
      } finally {
        if (active) setIsCheckingSession(false)
      }
    }

    checkSession()
    return () => { active = false }
  }, [])

  async function signIn(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const supabase = await getSupabase()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw new Error(`Could not sign in: ${signInError.message}`)
      setIsAuthenticated(true)
      setEmail(data.user?.email ?? email)
      setPassword('')
      setPhotos(await loadAdminPhotos(supabase))
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not sign in to the admin gallery.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signOut() {
    setError('')
    setIsSubmitting(true)
    try {
      const supabase = await getSupabase()
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw new Error(`Could not sign out: ${signOutError.message}`)
      setIsAuthenticated(false)
      setPhotos([])
      setPassword('')
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function refreshGallery() {
    setError('')
    setIsSubmitting(true)
    try {
      const supabase = await getSupabase()
      setPhotos(await loadAdminPhotos(supabase))
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh the admin gallery.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="receiver-page admin-page">
      <header className="receiver-header"><Brand compact /><span>Private admin gallery</span></header>
      {isCheckingSession ? (
        <div className="receiver-state"><LoaderCircle className="spin" size={24} /><p>Checking your sign-in...</p></div>
      ) : isAuthenticated ? (
        <main className="admin-content">
          <div className="admin-heading">
            <div>
              <span className="eyebrow"><LockKeyhole size={13} /> ADMIN ONLY</span>
              <h1>Community photos</h1>
              <p>Browse photos uploaded with gifts from this admin-only gallery.</p>
            </div>
            <div className="admin-actions">
              <button type="button" className="admin-signout" onClick={refreshGallery} disabled={isSubmitting}>
                {isSubmitting ? 'Refreshing...' : 'Refresh'}
              </button>
              <button type="button" className="admin-signout" onClick={signOut} disabled={isSubmitting}>Sign out</button>
            </div>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          {photos.length ? (
            <div className="admin-photo-grid">
              {photos.map((photo) => (
                <figure className="admin-photo" key={photo.path}>
                  <img src={photo.url} alt="Photo uploaded with a gift" loading="lazy" />
                  <figcaption>Uploaded {new Date(photo.createdAt).toLocaleDateString()}</figcaption>
                </figure>
              ))}
            </div>
          ) : !error ? (
            <p className="admin-empty">No community photos have been uploaded yet.</p>
          ) : null}
        </main>
      ) : (
        <main className="admin-login">
          <span className="eyebrow"><LockKeyhole size={13} /> PRIVATE ACCESS</span>
          <h1>Admin sign in</h1>
          <p>Sign in with the Supabase account registered for admin access.</p>
          <form onSubmit={signIn}>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="create-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><LoaderCircle className="spin" size={16} /> Signing in...</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>
          <a className="back-link admin-back-link" href="/"><ArrowLeft size={15} /> Back to Little Keepsake</a>
        </main>
      )}
      <footer className="receiver-footer"><Brand compact /><span>Keep the good things close.</span></footer>
    </div>
  )
}

function GiftPage({ giftId }) {
  const [gift, setGift] = useState(null)
  const [photos, setPhotos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    let active = true
    loadGift(giftId)
      .then((result) => {
        if (!active) return
        if (!result) {
          setError('This gift isn’t available in this browser. Ask the person who made it to share it from their device.')
          return
        }
        setGift(result)
        setPhotos(result.photos.map((photo) => ({ ...photo, src: photo.url })))
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'This gift could not be opened.')
      })
      .finally(() => { if (active) setIsLoading(false) })

    return () => {
      active = false
    }
  }, [giftId])

  return (
    <div className="receiver-page">
      <header className="receiver-header"><Brand compact /><span>A little something, just for you</span></header>
      {isLoading ? (
        <div className="receiver-state"><LoaderCircle className="spin" size={24} /><p>Finding your little gift...</p></div>
      ) : error ? (
        <motion.div className="receiver-state error-state" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <span className="error-gift-icon"><Gift size={23} /></span>
          <h1>Oh, it’s not here.</h1>
          <p>{error}</p>
          <a className="back-link" href="/"><ArrowLeft size={15} /> Make a gift instead</a>
        </motion.div>
      ) : !isOpen ? (
        <motion.section
          className="open-gift-state"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <span className="gift-sparkle sparkle-left"><Sparkles size={18} /></span>
          <motion.div className="envelope" animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <div className="envelope-flap" />
            <div className="envelope-heart"><Heart size={19} fill="currentColor" /></div>
          </motion.div>
          <span className="gift-sparkle sparkle-right"><Sparkles size={14} /></span>
          <div className="eyebrow receiver-eyebrow">A GIFT, WRAPPED IN MEMORIES</div>
          <h1>Someone sent you<br /><span>a little something.</span></h1>
          <p>Take a breath. This one’s just for you.</p>
          <button type="button" className="open-button" onClick={() => setIsOpen(true)}>Tap to open <ArrowRight size={16} /></button>
          <span className="tap-hint"><ChevronDown size={13} /> made with love, just for you</span>
        </motion.section>
      ) : (
        <motion.section className="opened-gift" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="gift-message" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <span className="eyebrow"><Heart size={13} /> A NOTE FOR YOU</span>
            <h1>{gift.message || 'A little reminder that you are loved.'}</h1>
            <p>A few moments, saved just for you.</p>
          </motion.div>
          {photos.length ? (
            <div className="received-photos">
              {photos.map((photo, index) => (
                <motion.figure
                  className="received-polaroid"
                  key={photo.name + index}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.09 }}
                  style={{ '--photo-index': index }}
                >
                  <img src={photo.src} alt={`Gift photo ${index + 1}`} />
                  <figcaption><span>little moment</span><Heart size={13} /></figcaption>
                </motion.figure>
              ))}
            </div>
          ) : (
            <p className="no-gift-photos">There aren’t any photos in this gift.</p>
          )}
          <button className="back-link back-to-home" type="button" onClick={() => setIsOpen(false)}><ArrowLeft size={14} /> Close your gift</button>
        </motion.section>
      )}
      <footer className="receiver-footer"><Brand compact /><span>Keep the good things close.</span></footer>
    </div>
  )
}

export default App
