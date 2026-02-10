import * as React from 'react'

type ChecklistItemData = {
    status: boolean | null
    comment: string
    photos: string[]
}

type Props = {
    isOpen: boolean
    onClose: () => void
    itemId: string
    itemLabel: string
    item: ChecklistItemData
    onSave: (status: boolean | null, comment: string) => Promise<void>
    onAddPhoto: (photoUrl: string) => Promise<void>
}

export default function ChecklistItemModal({ isOpen, onClose, itemId, itemLabel, item, onSave, onAddPhoto }: Props) {
    const [status, setStatus] = React.useState<boolean | null>(item.status)
    const [comment, setComment] = React.useState(item.comment || '')
    const [saving, setSaving] = React.useState(false)
    const [photoUrl, setPhotoUrl] = React.useState('')

    React.useEffect(() => {
        setStatus(item.status)
        setComment(item.comment || '')
    }, [item, itemId])

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(status, comment)
            onClose()
        } catch (e) {
            console.error('Save failed:', e)
        } finally {
            setSaving(false)
        }
    }

    const handleAddPhoto = async () => {
        if (!photoUrl.trim()) return
        try {
            await onAddPhoto(photoUrl.trim())
            setPhotoUrl('')
        } catch (e) {
            console.error('Add photo failed:', e)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-5 border-b border-[#e4e4e7]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-[#18181b]">{itemLabel}</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full hover:bg-[#f4f4f5] flex items-center justify-center text-slate-500 hover:text-[#18181b]"
                        >
                            X
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">ID: {itemId}</p>
                </div>

                <div className="p-5 space-y-5 overflow-y-auto flex-1">
                    <div>
                        <label className="text-sm font-medium text-[#18181b] block mb-2">Статус</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setStatus(true)}
                                className={`flex-1 h-12 rounded-xl border-2 font-medium transition-all ${status === true
                                        ? 'bg-[#18181b] border-[#18181b] text-white'
                                        : 'border-[#e4e4e7] text-slate-500 hover:border-[#18181b]'
                                    }`}
                            >
                                OK
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus(false)}
                                className={`flex-1 h-12 rounded-xl border-2 font-medium transition-all ${status === false
                                        ? 'bg-[#52525b] border-[#52525b] text-white'
                                        : 'border-[#e4e4e7] text-slate-500 hover:border-[#52525b]'
                                    }`}
                            >
                                Проблема
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus(null)}
                                className={`flex-1 h-12 rounded-xl border-2 font-medium transition-all ${status === null
                                        ? 'bg-[#f4f4f5] border-[#e4e4e7] text-[#18181b]'
                                        : 'border-[#e4e4e7] text-slate-500 hover:border-[#18181b]'
                                    }`}
                            >
                                Ожидание
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-[#18181b] block mb-2">Комментарий</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Добавьте комментарий по пункту проверки"
                            className="w-full h-24 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#18181b]"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-[#18181b] block mb-2">
                            Фото ({item.photos?.length || 0})
                        </label>

                        {item.photos && item.photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {item.photos.map((photo, idx) => (
                                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-[#f4f4f5]">
                                        <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={photoUrl}
                                onChange={(e) => setPhotoUrl(e.target.value)}
                                placeholder="Вставьте ссылку на фото"
                                className="flex-1 h-12 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] px-4 text-sm focus:outline-none focus:border-[#18181b]"
                            />
                            <button
                                type="button"
                                onClick={handleAddPhoto}
                                disabled={!photoUrl.trim()}
                                className="h-12 px-4 rounded-xl bg-[#18181b] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-[#e4e4e7] flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl border border-[#e4e4e7] text-slate-600 font-medium hover:bg-[#f4f4f5]"
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 h-12 rounded-xl bg-[#18181b] text-white font-medium disabled:opacity-50"
                    >
                        {saving ? 'Сохраняем...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    )
}
