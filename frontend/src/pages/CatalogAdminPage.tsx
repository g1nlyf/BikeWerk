import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, adminApi, resolveImageUrl } from '@/api'
import { calculateMarketingBreakdown, refreshRates } from '@/lib/pricing'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Bike = {
  id: number
  name: string
  brand: string
  model: string
  price: number
  discount?: number
  main_image?: string
  images?: string[]
}

export default function CatalogAdminPage() {
  const [bikeIdInput, setBikeIdInput] = useState('')
  const [bike, setBike] = useState<Bike | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [queue, setQueue] = useState<number[]>([])
  const [cursor, setCursor] = useState<number>(0)

  const [priceValue, setPriceValue] = useState(5)
  const [qualityAppearance, setQualityAppearance] = useState(5)
  const [detailIntent, setDetailIntent] = useState(5)
  const [trustConfidence, setTrustConfidence] = useState<number | null>(null)
  const [seasonalFit, setSeasonalFit] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [rankingScore, setRankingScore] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => {
    refreshRates().catch(() => void 0)
  }, [])

  const mainImage = useMemo(() => resolveImageUrl((bike?.images && bike.images[0]) || bike?.main_image), [bike])

  async function loadBike(id: number) {
    setLoading(true)
    try {
      const data = await apiGet(`/bikes/${id}`)
      if (data?.success) setBike(data.bike)
      const evalData = await adminApi.getEvaluation(id)
      const e = evalData?.evaluation || null
      if (e) {
        setPriceValue(e.price_value_score ?? 5)
        setQualityAppearance(e.quality_appearance_score ?? 5)
        setDetailIntent(e.detail_intent_score ?? 5)
        setTrustConfidence(e.trust_confidence_score ?? null)
        setSeasonalFit(e.seasonal_fit_score ?? null)
        setNotes(e.notes ?? '')
      } else {
        setPriceValue(5)
        setQualityAppearance(5)
        setDetailIntent(5)
        setTrustConfidence(null)
        setSeasonalFit(null)
        setNotes('')
      }
      const met = await adminApi.getMetrics(id)
      setMetrics(met?.metrics || null)
    } finally {
      setLoading(false)
    }
  }

  async function saveEvaluation() {
    if (!bike?.id) return
    setSaving(true)
    try {
      const res = await adminApi.saveEvaluation(bike.id, {
        price_value_score: priceValue,
        quality_appearance_score: qualityAppearance,
        detail_intent_score: detailIntent,
        trust_confidence_score: trustConfidence,
        seasonal_fit_score: seasonalFit,
        notes,
      })
      if (res?.ranking_score != null) setRankingScore(res.ranking_score)
    } finally {
      setSaving(false)
    }
  }

  async function recompute() {
    if (!bike?.id) return
    setRecomputing(true)
    try {
      const res = await adminApi.recompute(bike.id)
      if (res?.ranking_score != null) setRankingScore(res.ranking_score)
    } finally {
      setRecomputing(false)
    }
  }

  async function startQueue() {
    setLoading(true)
    try {
      const res = await adminApi.listPending(100, 0)
      const ids = Array.isArray(res?.bikes) ? res.bikes.map((b: any) => Number(b.id)) : []
      setQueue(ids)
      setCursor(0)
      if (ids.length > 0) await loadBike(ids[0])
    } finally {
      setLoading(false)
    }
  }

  async function nextInQueue() {
    if (!bike?.id) return
    await saveEvaluation()
    const nextIndex = cursor + 1
    if (nextIndex < queue.length) {
      setCursor(nextIndex)
      await loadBike(queue[nextIndex])
    } else {
      setBike(null)
    }
  }

  async function prevInQueue() {
    const prevIndex = cursor - 1
    if (prevIndex >= 0) {
      setCursor(prevIndex)
      await loadBike(queue[prevIndex])
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <h1 className="text-xl font-semibold">Админ‑оценка каталога</h1>
      <div className="flex flex-wrap gap-2">
        <Button onClick={startQueue} disabled={loading}>Начать оценку новых байков</Button>
        <div className="flex gap-2">
          <Input placeholder="ID байка" value={bikeIdInput} onChange={e => setBikeIdInput(e.target.value)} />
          <Button onClick={() => { const id = parseInt(bikeIdInput); if (id) loadBike(id) }} disabled={!bikeIdInput || loading}>Изменить оценку по ID</Button>
        </div>
      </div>
      {bike && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            {mainImage && <img src={mainImage} alt={bike.name} className="w-40 h-40 object-cover rounded" />}
            <div className="flex-1">
              <div className="text-lg font-medium">{bike.name}</div>
              <div className="text-sm text-muted-foreground">{bike.brand} {bike.model}</div>
              <div className="text-base font-semibold">
                {bike.price?.toLocaleString()} €
                <span className="text-muted-foreground mx-2">/</span>
                {Math.round(calculateMarketingBreakdown(bike.price || 0).totalRub).toLocaleString()} ₽
                {bike.discount ? ` (−${bike.discount}%)` : ''}
              </div>
              {rankingScore != null && <div className="text-sm">Ранг: {(rankingScore * 100).toFixed(1)}%</div>}
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <div className="mb-2">Насколько выгодно выглядит с точки зрения цены?</div>
              <Slider value={[priceValue]} onValueChange={v => setPriceValue(v[0])} min={1} max={10} step={1} />
              <div className="text-sm">{priceValue}</div>
            </div>
            <div>
              <div className="mb-2">Насколько качественно выглядит байк?</div>
              <Slider value={[qualityAppearance]} onValueChange={v => setQualityAppearance(v[0])} min={1} max={10} step={1} />
              <div className="text-sm">{qualityAppearance}</div>
            </div>
            <div>
              <div className="mb-2">Насколько вероятно, что ты бы нажал подробнее?</div>
              <Slider value={[detailIntent]} onValueChange={v => setDetailIntent(v[0])} min={1} max={10} step={1} />
              <div className="text-sm">{detailIntent}</div>
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setAdvancedOpen(v => !v)}>{advancedOpen ? 'Скрыть расширенные' : 'Расширенные параметры'}</Button>
            </div>
            {advancedOpen && (
              <div className="space-y-6">
                <div>
                  <div className="mb-2">Насколько предложение выглядит надёжным?</div>
                  <Slider value={[trustConfidence ?? 5]} onValueChange={v => setTrustConfidence(v[0])} min={1} max={10} step={1} />
                  <div className="text-sm">{trustConfidence ?? 5}</div>
                </div>
                <div>
                  <div className="mb-2">Насколько это предложение релевантно сейчас?</div>
                  <Slider value={[seasonalFit ?? 5]} onValueChange={v => setSeasonalFit(v[0])} min={1} max={10} step={1} />
                  <div className="text-sm">{seasonalFit ?? 5}</div>
                </div>
              </div>
            )}
            <div>
              <div className="mb-2">Заметки</div>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Короткие пометки" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveEvaluation} disabled={saving}>Сохранить</Button>
            <Button onClick={recompute} variant="outline" disabled={recomputing}>Пересчитать</Button>
            {queue.length > 0 && (
              <>
                <Button variant="secondary" onClick={prevInQueue} disabled={cursor <= 0}>Назад</Button>
                <Button onClick={nextInQueue} disabled={cursor >= queue.length}>Дальше</Button>
                <div className="text-xs text-muted-foreground">{queue.length > 0 ? `${cursor+1} / ${queue.length}` : ''}</div>
              </>
            )}
          </div>
          <div className="pt-2">
            <div className="text-sm font-medium mb-2">Метрики</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div>Показы: {metrics?.impressions ?? 0}</div>
              <div>Клики: {metrics?.detail_clicks ?? 0}</div>
              <div>ATC: {metrics?.add_to_cart ?? 0}</div>
              <div>Заказы: {metrics?.orders ?? 0}</div>
              <div>Избранное: {metrics?.favorites ?? 0}</div>
              <div>Шеринг: {metrics?.shares ?? 0}</div>
              <div>Время на стр.: {metrics?.avg_dwell_ms ?? 0} мс</div>
              <div>Отказы: {metrics?.bounces ?? 0}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}