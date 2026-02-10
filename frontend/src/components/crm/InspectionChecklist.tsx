import * as React from 'react'

type ChecklistItemData = {
    status: boolean | null
    comment: string
    photos: string[]
    updated_at?: string
}

type ChecklistProgress = {
    total: number
    completed: number
    passed: number
    failed: number
    percentage: number
}

type Props = {
    orderId: string
    checklist: Record<string, ChecklistItemData>
    progress: ChecklistProgress
    loading?: boolean
    onItemClick: (itemId: string, item: ChecklistItemData) => void
    onRefresh: () => void
}

const CHECKLIST_ITEMS = [
    { key: '1_brand_verified', label: 'Бренд подтвержден', category: 'identification' },
    { key: '2_model_verified', label: 'Модель подтверждена', category: 'identification' },
    { key: '3_year_verified', label: 'Год подтвержден', category: 'identification' },
    { key: '4_frame_size_verified', label: 'Размер рамы подтвержден', category: 'identification' },
    { key: '5_serial_number', label: 'Серийный номер', category: 'identification' },
    { key: '6_frame_condition', label: 'Состояние рамы', category: 'condition' },
    { key: '7_fork_condition', label: 'Состояние вилки', category: 'condition' },
    { key: '8_shock_condition', label: 'Состояние амортизатора', category: 'condition' },
    { key: '9_drivetrain_condition', label: 'Состояние трансмиссии', category: 'condition' },
    { key: '10_brakes_condition', label: 'Состояние тормозов', category: 'condition' },
    { key: '11_wheels_condition', label: 'Состояние колес', category: 'condition' },
    { key: '12_tires_condition', label: 'Состояние покрышек', category: 'condition' },
    { key: '13_headset_check', label: 'Проверка рулевой', category: 'mechanics' },
    { key: '14_bottom_bracket_check', label: 'Проверка каретки', category: 'mechanics' },
    { key: '15_suspension_service_history', label: 'История сервиса подвески', category: 'mechanics' },
    { key: '16_brake_pads_percentage', label: 'Износ колодок (%)', category: 'mechanics' },
    { key: '17_chain_wear', label: 'Износ цепи', category: 'mechanics' },
    { key: '18_cassette_wear', label: 'Износ кассеты', category: 'mechanics' },
    { key: '19_rotor_condition', label: 'Состояние роторов', category: 'mechanics' },
    { key: '20_bearing_play', label: 'Люфт подшипников', category: 'mechanics' },
    { key: '21_original_owner', label: 'Первый владелец', category: 'history' },
    { key: '22_proof_of_purchase', label: 'Документы покупки', category: 'history' },
    { key: '23_warranty_status', label: 'Статус гарантии', category: 'history' },
    { key: '24_crash_history', label: 'История падений', category: 'history' },
    { key: '25_reason_for_sale', label: 'Причина продажи', category: 'history' },
    { key: '26_upgrades_verified', label: 'Апгрейды подтверждены', category: 'final' },
    { key: '27_test_ride_completed', label: 'Тест-райд выполнен', category: 'final' },
    { key: '28_final_approval', label: 'Финальное одобрение', category: 'final' }
]

const CATEGORIES = [
    { key: 'identification', label: 'Идентификация', color: 'bg-white border-[#e4e4e7]' },
    { key: 'condition', label: 'Состояние', color: 'bg-white border-[#e4e4e7]' },
    { key: 'mechanics', label: 'Механика', color: 'bg-white border-[#e4e4e7]' },
    { key: 'history', label: 'История', color: 'bg-white border-[#e4e4e7]' },
    { key: 'final', label: 'Итог', color: 'bg-white border-[#e4e4e7]' }
]

export default function InspectionChecklist({ orderId, checklist, progress, loading = false, onItemClick, onRefresh }: Props) {
    const getItem = (key: string): ChecklistItemData => {
        return checklist[key] || { status: null, comment: '', photos: [] }
    }

    const getStatusIcon = (status: boolean | null) => {
        if (status === true) return 'OK'
        if (status === false) return 'NO'
        return '--'
    }

    const getStatusClass = (status: boolean | null) => {
        if (status === true) return 'bg-[#18181b] text-white'
        if (status === false) return 'bg-[#52525b] text-white'
        return 'bg-[#e4e4e7] text-[#52525b]'
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#18181b]">
                        Прогресс проверки
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                            {progress.completed} / {progress.total} заполнено
                        </span>
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="text-xs text-slate-500 underline"
                        >
                            Обновить
                        </button>
                    </div>
                </div>
                <div className="h-3 bg-[#f4f4f5] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#18181b] transition-all duration-500"
                        style={{ width: `${progress.percentage}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>ОК: {progress.passed}</span>
                    <span>Проблемы: {progress.failed}</span>
                    <span>В ожидании: {progress.total - progress.completed}</span>
                </div>
                {orderId ? <div className="mt-2 text-[11px] text-slate-400">Заказ: {orderId}</div> : null}
            </div>

            {loading && (
                <div className="rounded-xl border border-[#e4e4e7] bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="h-4 w-28 rounded bg-[#e4e4e7]" />
                        <div className="h-4 w-10 rounded bg-[#e4e4e7]" />
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="h-12 rounded-lg bg-[#f4f4f5]" />
                        ))}
                    </div>
                </div>
            )}

            {!loading && CATEGORIES.map(category => {
                const items = CHECKLIST_ITEMS.filter(i => i.category === category.key)
                const categoryCompleted = items.filter(i => {
                    const item = getItem(i.key)
                    return item.status === true || item.status === false
                }).length

                return (
                    <div key={category.key} className={`rounded-xl border ${category.color} p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-[#18181b]">{category.label}</h3>
                            <span className="text-xs text-slate-500">
                                {categoryCompleted}/{items.length}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {items.map(itemMeta => {
                                const item = getItem(itemMeta.key)
                                const hasComment = Boolean(item.comment)
                                const hasPhotos = item.photos && item.photos.length > 0

                                return (
                                    <div
                                        key={itemMeta.key}
                                        onClick={() => onItemClick(itemMeta.key, item)}
                                        className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#e4e4e7] cursor-pointer hover:border-[#18181b] hover:shadow-sm transition-all group"
                                    >
                                        <div className={`w-10 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getStatusClass(item.status)}`}>
                                            {getStatusIcon(item.status)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-[#18181b] group-hover:text-black">
                                                {itemMeta.label}
                                            </div>
                                            {hasComment && (
                                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                                    Есть комментарий
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hasPhotos && (
                                                <span className="text-xs text-slate-400">
                                                    Фото: {item.photos.length}
                                                </span>
                                            )}
                                            <span className="text-slate-300 group-hover:text-slate-500">{'>'}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
