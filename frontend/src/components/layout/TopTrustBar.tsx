import { Link } from 'react-router-dom';
import { Globe, Shield, Truck, MessageCircle, Phone, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthTriggerButton } from '@/components/auth/AuthOverlay';

export function TopTrustBar() {
    const { user } = useAuth();

    return (
        <div className="w-full bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50 sticky top-0 z-[60]">
            <div className="max-w-7xl mx-auto px-4">
                {/* Desktop view */}
                <div className="hidden md:grid grid-cols-3 items-center h-10 text-xs">
                    {/* Left: Trust indicators */}
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Работаем в Германии</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5" />
                            <span>Проверка перед оплатой</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5" />
                            <span>Доставка в РФ</span>
                        </div>
                    </div>

                    {/* Center: Navigation links */}
                    <div className="flex items-center justify-center gap-4">
                        <Link
                            to="/how-it-works"
                            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                        >
                            Как это работает
                        </Link>
                        <Link
                            to="/guarantees"
                            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                        >
                            Гарантии
                        </Link>
                        <Link
                            to="/delivery"
                            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                        >
                            Доставка
                        </Link>
                        <Link
                            to="/payment"
                            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                        >
                            Оплата
                        </Link>
                        <Link
                            to="/documents"
                            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                        >
                            Документы
                        </Link>
                    </div>

                    {/* Right: Communication + Auth */}
                    <div className="flex items-center justify-end gap-3">
                        <a
                            href="https://wa.me/YOUR_NUMBER"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Чат</span>
                        </a>
                        <a
                            href="https://wa.me/YOUR_NUMBER"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Phone className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                        </a>
                        {user ? (
                            <Link to="/account" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                <User className="h-3.5 w-3.5" />
                                <span>{user.name || 'Профиль'}</span>
                            </Link>
                        ) : (
                            <AuthTriggerButton className="h-auto py-1 px-2 text-xs font-medium" />
                        )}
                    </div>
                </div>

                {/* Mobile view - simplified */}
                <div className="flex md:hidden items-center justify-between h-9 text-xs overflow-x-auto">
                    <div className="flex items-center gap-3 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>Германия → РФ</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            <span>Гарантии</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href="https://wa.me/YOUR_NUMBER"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="WhatsApp"
                        >
                            <Phone className="h-3.5 w-3.5" />
                        </a>
                        {!user && (
                            <AuthTriggerButton className="h-auto py-0.5 px-2 text-xs" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
