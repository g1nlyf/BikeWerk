import { type ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDeposit(price: number, currency: string = 'RUB'): string {
  // 2% deposit calculation
  const deposit = Math.round(price * 0.02);
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(deposit);
}