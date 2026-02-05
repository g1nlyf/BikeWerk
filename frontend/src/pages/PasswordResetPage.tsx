import * as React from 'react'
import Header from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { auth } from '@/api'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function isStrongPassword(pw: string): boolean {
  const s = (pw || '').trim()
  // Облегчённое правило: только минимальная длина
  return s.length >= 8
}

export default function PasswordResetPage() {
  const [step, setStep] = React.useState<1|2|3>(1)
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [resetToken, setResetToken] = React.useState<string | null>(null)
  const [password, setPassword] = React.useState('')
  const [password2, setPassword2] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!isValidEmail(email)) {
      setError('Введите корректный email')
      return
    }
    setLoading(true)
    try {
      const res = await auth.resetRequest(email)
      if (res?.success) {
        setMessage('Код отправлен на ваш email. Проверьте почту.')
        setStep(2)
      } else {
        setError(res?.error || 'Не удалось отправить код')
      }
    } catch (err) {
      setError('Ошибка сети при запросе восстановления')
    } finally {
      setLoading(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!isValidEmail(email) || !code.trim()) {
      setError('Заполните email и код')
      return
    }
    setLoading(true)
    try {
      const res = await auth.resetVerify(email, code)
      if (res?.success && res?.reset_token) {
        setResetToken(res.reset_token)
        setStep(3)
        setMessage('Код подтверждён. Можете задать новый пароль.')
      } else {
        setError(res?.error || 'Неверный код')
      }
    } catch (err) {
      setError('Ошибка сети при проверке кода')
    } finally {
      setLoading(false)
    }
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!resetToken) {
      setError('Отсутствует токен подтверждения. Пройдите предыдущие шаги.')
      return
    }
    if (!isStrongPassword(password)) {
      setError('Пароль должен быть не менее 8 символов')
      return
    }
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setLoading(true)
    try {
      const res = await auth.resetConfirm(email, resetToken, password, password2)
      if (res?.success) {
        setMessage('Пароль успешно изменён. Теперь можно войти.')
        // Опционально: редирект через несколько секунд
        setTimeout(() => { window.location.href = '/login' }, 1500)
      } else {
        setError(res?.error || 'Не удалось изменить пароль')
      }
    } catch (err) {
      setError('Ошибка сети при смене пароля')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Восстановление пароля</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <form className="space-y-3" onSubmit={submitEmail}>
                <Input type="email" placeholder="Ваш email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {error && <div className="text-sm text-destructive">{error}</div>}
                {message && <div className="text-sm text-muted-foreground">{message}</div>}
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Отправка…' : 'Восстановить пароль'}</Button>
              </form>
            )}
            {step === 2 && (
              <form className="space-y-3" onSubmit={submitCode}>
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input type="text" inputMode="numeric" maxLength={6} placeholder="Код из письма (6 цифр)" value={code} onChange={(e) => setCode(e.target.value)} />
                {error && <div className="text-sm text-destructive">{error}</div>}
                {message && <div className="text-sm text-muted-foreground">{message}</div>}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>Назад</Button>
                  <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Проверка…' : 'Подтвердить код'}</Button>
                </div>
              </form>
            )}
            {step === 3 && (
              <form className="space-y-3" onSubmit={submitPassword}>
                <Input type="password" placeholder="Новый пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Input type="password" placeholder="Повторите новый пароль" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                {error && <div className="text-sm text-destructive">{error}</div>}
                {message && <div className="text-sm text-muted-foreground">{message}</div>}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setStep(2)}>Назад</Button>
                  <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Сохранение…' : 'Сменить пароль'}</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}