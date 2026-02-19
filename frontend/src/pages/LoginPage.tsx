import * as React from 'react'
import BikeflipHeaderPX from '@/components/layout/BikeflipHeaderPX'
import { SEOHead } from '@/components/SEO/SEOHead'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { LegalConsentFields } from '@/components/legal/LegalConsentFields'
import { DEFAULT_FORM_LEGAL_CONSENT, hasRequiredFormLegalConsent } from '@/lib/legal'

export default function LoginPage() {
  const { login, register, user, token } = useAuth() as any
  const [mode, setMode] = React.useState<'login'|'register'>('login')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [legalConsent, setLegalConsent] = React.useState(DEFAULT_FORM_LEGAL_CONSENT)
  const [error, setError] = React.useState<string | null>(null)
  const [debug, setDebug] = React.useState<string | null>(null)
  const [returnTo] = React.useState<string>(() => {
    try {
      const u = new URL(window.location.href)
      const r = u.searchParams.get('return')
      return r || '/catalog'
    } catch { return '/catalog' }
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDebug(null)
    if (mode === 'register' && !hasRequiredFormLegalConsent(legalConsent)) {
      setError('Подтвердите согласие с условиями оферты и обработкой персональных данных')
      return
    }
    const result = mode === 'login' ? await login(email, password) : await register(name, email, password)
    if (!result.success) {
      setError(result.error || 'Не удалось выполнить операцию')
      try {
        setDebug(JSON.stringify(result.data ?? { message: result.error }, null, 2))
      } catch {
        setDebug(String(result.data ?? result.error ?? ''))
      }
    } else {
      window.location.href = returnTo
    }
  }

  if (user && token) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead title="Вход - BikeWerk" />
        <BikeflipHeaderPX />
        <main className="container mx-auto px-4 py-10">
          <Card className="max-w-md mx-auto">
            <CardHeader><CardTitle>Вы уже вошли</CardTitle></CardHeader>
            <CardContent>
              <p>Добро пожаловать, {user.name || user.email}!</p>
              <div className="mt-4"><Button onClick={() => (window.location.href = '/catalog')}>Перейти в каталог</Button></div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={mode === 'login' ? 'Вход - BikeWerk' : 'Регистрация - BikeWerk'} />
      <BikeflipHeaderPX />
      <main className="container mx-auto px-4 py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{mode === 'login' ? 'Вход' : 'Регистрация'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmit}>
              {mode === 'register' && (
                <Input placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" minLength={8} placeholder="Пароль (минимум 8 символов)" value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === 'register' && (
                <LegalConsentFields value={legalConsent} onChange={setLegalConsent} compact />
              )}
              {error && <div className="text-sm text-destructive">{error}</div>}
              {debug && (
                <details className="rounded-md border p-2 text-xs">
                  <summary className="cursor-pointer">Логи</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">{debug}</pre>
                </details>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={mode === 'register' && !hasRequiredFormLegalConsent(legalConsent)}
              >
                {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Button>
            </form>
            <div className="mt-4 text-sm">
              {mode === 'login' ? (
                <button className="underline" onClick={() => setMode('register')}>Нет аккаунта? Регистрация</button>
              ) : (
                <button className="underline" onClick={() => setMode('login')}>У меня уже есть аккаунт</button>
              )}
              <div className="mt-2">
                <a className="underline" href="/password-reset">Забыли пароль?</a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
