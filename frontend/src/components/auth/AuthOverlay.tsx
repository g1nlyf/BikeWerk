"use client"

import * as React from 'react'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { X, Mail, Lock, User, ArrowLeft, Loader2, CheckCircle2, KeyRound } from 'lucide-react'
import { auth } from '@/api'
import { cn } from '@/lib/utils'
import { LegalConsentFields } from '@/components/legal/LegalConsentFields'
import { DEFAULT_FORM_LEGAL_CONSENT, hasRequiredFormLegalConsent } from '@/lib/legal'

type AuthMode =
    | 'login'
    | 'login-code'
    | 'register'
    | 'register-verify'
    | 'forgot'
    | 'forgot-code'
    | 'forgot-password'
    | 'success'

interface AuthOverlayProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialMode?: 'login' | 'register'
    onSuccess?: () => void
}

// 6-digit code input component
function CodeInput({
    value,
    onChange,
    disabled
}: {
    value: string
    onChange: (val: string) => void
    disabled?: boolean
}) {
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])
    const digits = value.padEnd(6, '').split('').slice(0, 6)

    const handleChange = (index: number, char: string) => {
        if (!/^\d*$/.test(char)) return
        const newDigits = [...digits]
        newDigits[index] = char.slice(-1)
        onChange(newDigits.join(''))
        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        onChange(pasted)
        const nextIndex = Math.min(pasted.length, 5)
        inputRefs.current[nextIndex]?.focus()
    }

    return (
        <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digits[i] || ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={cn(
                        "w-11 h-14 text-center text-2xl font-semibold rounded-xl border-2",
                        "bg-white dark:bg-zinc-900 transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        digits[i] ? "border-zinc-400" : "border-zinc-200 dark:border-zinc-700"
                    )}
                />
            ))}
        </div>
    )
}

// Timer component for resend cooldown
function ResendTimer({
    seconds,
    onResend
}: {
    seconds: number
    onResend: () => void
}) {
    const [remaining, setRemaining] = React.useState(seconds)

    React.useEffect(() => {
        setRemaining(seconds)
    }, [seconds])

    React.useEffect(() => {
        if (remaining <= 0) return
        const timer = setInterval(() => {
            setRemaining(r => Math.max(0, r - 1))
        }, 1000)
        return () => clearInterval(timer)
    }, [remaining])

    const mins = Math.floor(remaining / 60)
    const secs = remaining % 60

    if (remaining > 0) {
        return (
            <p className="text-sm text-zinc-500 text-center">
                Отправить повторно через {mins}:{secs.toString().padStart(2, '0')}
            </p>
        )
    }

    return (
        <button
            type="button"
            onClick={onResend}
            className="text-sm text-zinc-900 dark:text-white underline hover:no-underline text-center w-full"
        >
            Отправить код повторно
        </button>
    )
}

export function AuthOverlay({ open, onOpenChange, initialMode = 'login', onSuccess }: AuthOverlayProps) {
    const [mode, setMode] = React.useState<AuthMode>(initialMode)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    // Form data
    const [name, setName] = React.useState('')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [code, setCode] = React.useState('')
    const [newPassword, setNewPassword] = React.useState('')
    const [legalConsent, setLegalConsent] = React.useState(DEFAULT_FORM_LEGAL_CONSENT)

    // Resend timer
    const [resendIn, setResendIn] = React.useState(0)

    // Reset state when dialog opens/closes
    React.useEffect(() => {
        if (open) {
            setMode(initialMode)
            setError(null)
            setCode('')
            setLegalConsent(DEFAULT_FORM_LEGAL_CONSENT)
        }
    }, [open, initialMode])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const result = await auth.login(email, password)
        setLoading(false)

        if (result?.success) {
            setMode('success')
            setTimeout(() => {
                onSuccess?.()
                onOpenChange(false)
                window.location.reload()
            }, 1500)
        } else {
            setError(result?.error || 'Не удалось войти')
        }
    }

    const handleSendLoginCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const result = await auth.sendCode(email)
        setLoading(false)

        if (result?.success) {
            setResendIn(result.resendAvailableIn || 60)
            setMode('login-code')
        } else {
            setError(result?.error || 'Не удалось отправить код')
        }
    }

    const handleVerifyLoginCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (code.length !== 6) return

        setLoading(true)
        setError(null)

        const result = await auth.verifyCode(email, code)
        setLoading(false)

        if (result?.success) {
            setMode('success')
            setTimeout(() => {
                onSuccess?.()
                onOpenChange(false)
                window.location.reload()
            }, 1500)
        } else {
            setError(result?.error || 'Неверный код')
        }
    }

    const handleRegisterPending = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hasRequiredFormLegalConsent(legalConsent)) {
            setError('Подтвердите согласие с условиями оферты и обработкой персональных данных')
            return
        }
        setLoading(true)
        setError(null)

        const result = await auth.registerPending(name, email, password)
        setLoading(false)

        if (result?.success) {
            setResendIn(result.resendAvailableIn || 60)
            setMode('register-verify')
        } else {
            setError(result?.error || 'Не удалось зарегистрироваться')
        }
    }

    const handleConfirmRegistration = async (e: React.FormEvent) => {
        e.preventDefault()
        if (code.length !== 6) return

        setLoading(true)
        setError(null)

        const result = await auth.confirmRegistration(email, code)
        setLoading(false)

        if (result?.success) {
            setMode('success')
            setTimeout(() => {
                onSuccess?.()
                onOpenChange(false)
                window.location.reload()
            }, 1500)
        } else {
            setError(result?.error || 'Неверный код')
        }
    }

    const handleForgotRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const result = await auth.requestPasswordReset(email)
        setLoading(false)

        if (result?.success) {
            setResendIn(result.resendAvailableIn || 60)
            setMode('forgot-code')
        } else {
            setError(result?.error || 'Не удалось отправить код')
        }
    }

    const handleForgotVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (code.length !== 6) return
        setMode('forgot-password')
        setError(null)
    }

    const handleForgotConfirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword.length < 8) {
            setError('Пароль должен содержать минимум 8 символов')
            return
        }

        setLoading(true)
        setError(null)

        const result = await auth.confirmPasswordReset(email, code, newPassword)
        setLoading(false)

        if (result?.success) {
            setMode('success')
            setTimeout(() => {
                onSuccess?.()
                onOpenChange(false)
                window.location.reload()
            }, 1500)
        } else {
            setError(result?.error || 'Не удалось сменить пароль')
        }
    }

    const handleResend = async () => {
        setLoading(true)
        const result = await auth.resendCode(email)
        setLoading(false)
        if (result?.success) {
            setResendIn(result.resendAvailableIn || 60)
            setError(null)
        } else {
            setError(result?.error || 'Не удалось отправить код')
        }
    }

    const goBack = () => {
        setError(null)
        setCode('')
        if (mode === 'login-code') setMode('login')
        else if (mode === 'register-verify') setMode('register')
        else if (mode === 'forgot-code' || mode === 'forgot-password') setMode('forgot')
        else if (mode === 'forgot') setMode('login')
        else setMode('login')
    }

    const renderHeader = () => {
        const titles: Record<AuthMode, { title: string; desc: string }> = {
            'login': { title: 'С возвращением', desc: 'Введите данные для входа' },
            'login-code': { title: 'Введите код', desc: `Код отправлен на ${email}` },
            'register': { title: 'Создать аккаунт', desc: 'Заполните данные для регистрации' },
            'register-verify': { title: 'Подтвердите email', desc: `Код отправлен на ${email}` },
            'forgot': { title: 'Восстановление пароля', desc: 'Введите email для получения кода' },
            'forgot-code': { title: 'Введите код', desc: `Код отправлен на ${email}` },
            'forgot-password': { title: 'Новый пароль', desc: 'Придумайте надёжный пароль' },
            'success': { title: 'Готово!', desc: 'Вы успешно вошли в аккаунт' },
        }
        const { title, desc } = titles[mode]

        return (
            <div className="text-center mb-6">
                {mode !== 'login' && mode !== 'register' && mode !== 'success' && (
                    <button
                        type="button"
                        onClick={goBack}
                        className="absolute left-4 top-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}

                {mode === 'success' ? (
                    <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                ) : (
                    <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        {mode.includes('forgot') ? (
                            <KeyRound className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                        ) : mode.includes('register') ? (
                            <User className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                        ) : (
                            <Lock className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                        )}
                    </div>
                )}

                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{title}</h2>
                <p className="text-sm text-zinc-500 mt-1">{desc}</p>
            </div>
        )
    }

    const renderContent = () => {
        if (mode === 'success') {
            return (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                </div>
            )
        }

        if (mode === 'login') {
            return (
                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Пароль</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                minLength={8}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => { setError(null); setMode('forgot') }}
                            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                            Забыли пароль?
                        </button>
                    </div>

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Войти'}
                    </Button>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">или</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 rounded-xl text-base"
                        onClick={handleSendLoginCode}
                        disabled={loading || !email}
                    >
                        Войти по коду из email
                    </Button>

                    <p className="text-center text-sm text-zinc-500">
                        Нет аккаунта?{' '}
                        <button
                            type="button"
                            onClick={() => { setError(null); setMode('register') }}
                            className="text-zinc-900 dark:text-white font-medium hover:underline"
                        >
                            Зарегистрироваться
                        </button>
                    </p>
                </form>
            )
        }

        if (mode === 'login-code') {
            return (
                <form onSubmit={handleVerifyLoginCode} className="space-y-6">
                    <CodeInput value={code} onChange={setCode} disabled={loading} />

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button
                        type="submit"
                        className="w-full h-12 rounded-xl text-base"
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Подтвердить'}
                    </Button>

                    <ResendTimer seconds={resendIn} onResend={handleResend} />
                </form>
            )
        }

        if (mode === 'register') {
            return (
                <form onSubmit={handleRegisterPending} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Как к вам обращаться?</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="name"
                                type="text"
                                placeholder="Иван"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reg-email">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="reg-email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reg-password">Пароль</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="reg-password"
                                type="password"
                                placeholder="Минимум 8 символов"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                minLength={8}
                                required
                            />
                        </div>
                        <p className="text-xs text-zinc-500">Минимум 8 символов</p>
                    </div>

                    <LegalConsentFields value={legalConsent} onChange={setLegalConsent} compact />

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Продолжить'}
                    </Button>

                    <p className="text-center text-sm text-zinc-500">
                        Уже есть аккаунт?{' '}
                        <button
                            type="button"
                            onClick={() => { setError(null); setMode('login') }}
                            className="text-zinc-900 dark:text-white font-medium hover:underline"
                        >
                            Войти
                        </button>
                    </p>
                </form>
            )
        }

        if (mode === 'register-verify') {
            return (
                <form onSubmit={handleConfirmRegistration} className="space-y-6">
                    <CodeInput value={code} onChange={setCode} disabled={loading} />

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button
                        type="submit"
                        className="w-full h-12 rounded-xl text-base"
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Подтвердить email'}
                    </Button>

                    <ResendTimer seconds={resendIn} onResend={handleResend} />
                </form>
            )
        }

        if (mode === 'forgot') {
            return (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="forgot-email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                required
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отправить код'}
                    </Button>

                    <p className="text-center text-sm text-zinc-500">
                        Вспомнили пароль?{' '}
                        <button
                            type="button"
                            onClick={() => { setError(null); setMode('login') }}
                            className="text-zinc-900 dark:text-white font-medium hover:underline"
                        >
                            Войти
                        </button>
                    </p>
                </form>
            )
        }

        if (mode === 'forgot-code') {
            return (
                <form onSubmit={handleForgotVerifyCode} className="space-y-6">
                    <CodeInput value={code} onChange={setCode} disabled={loading} />

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button
                        type="submit"
                        className="w-full h-12 rounded-xl text-base"
                        disabled={loading || code.length !== 6}
                    >
                        Продолжить
                    </Button>

                    <ResendTimer seconds={resendIn} onResend={handleResend} />
                </form>
            )
        }

        if (mode === 'forgot-password') {
            return (
                <form onSubmit={handleForgotConfirm} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">Новый пароль</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <Input
                                id="new-password"
                                type="password"
                                placeholder="Минимум 8 символов"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pl-10 h-12 rounded-xl"
                                minLength={8}
                                required
                            />
                        </div>
                        <p className="text-xs text-zinc-500">Минимум 8 символов</p>
                    </div>

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Сохранить пароль'}
                    </Button>
                </form>
            )
        }

        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[380px] p-5 rounded-2xl border-zinc-200 dark:border-zinc-800">
                <DialogClose asChild>
                    <button
                        aria-label="close"
                        className="absolute right-4 top-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </DialogClose>

                {renderHeader()}
                {renderContent()}
            </DialogContent>
        </Dialog>
    )
}

// Trigger button component
export function AuthTriggerButton({
    variant = 'outline',
    className = '',
    label = 'Войти'
}: {
    variant?: 'outline' | 'default'
    className?: string
    label?: string
}) {
    const [open, setOpen] = React.useState(false)

    return (
        <>
            <Button variant={variant} size="sm" onClick={() => setOpen(true)} className={className}>
                {label}
            </Button>
            <AuthOverlay open={open} onOpenChange={setOpen} initialMode="login" />
        </>
    )
}
