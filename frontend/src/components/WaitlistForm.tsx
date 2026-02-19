import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LegalConsentFields } from '@/components/legal/LegalConsentFields';
import { apiPost } from '@/api';
import { DEFAULT_FORM_LEGAL_CONSENT, hasRequiredFormLegalConsent } from '@/lib/legal';

interface WaitlistFormProps {
  initialBrand?: string;
  initialModel?: string;
  onClose?: () => void;
}

export const WaitlistForm: React.FC<WaitlistFormProps> = ({ initialBrand = '', initialModel = '', onClose }) => {
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState(initialModel);
  const [maxPrice, setMaxPrice] = useState('');
  const [contactMethod, setContactMethod] = useState<'telegram' | 'email'>('email');
  const [contactValue, setContactValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('Произошла ошибка. Попробуйте еще раз.');
  const [legalConsent, setLegalConsent] = useState(DEFAULT_FORM_LEGAL_CONSENT);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRequiredFormLegalConsent(legalConsent)) {
      setErrorMessage('Подтвердите согласие с условиями оферты и обработкой персональных данных.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMessage('Произошла ошибка. Попробуйте еще раз.');
    
    try {
      const payload: any = {
        brand,
        model,
        max_price: maxPrice
      };

      if (contactMethod === 'telegram') {
        payload.telegram_chat_id = contactValue;
      } else {
        payload.email = contactValue;
      }

      await apiPost('/waitlist/add', payload);
      setStatus('success');
      setTimeout(() => onClose && onClose(), 2000);
    } catch (error) {
      console.error(error);
      setErrorMessage('Произошла ошибка. Попробуйте еще раз.');
      setStatus('error');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-md w-full relative">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
      >
        <X className="w-5 h-5 text-gray-500" />
      </button>

      <div className="text-center mb-6">
        <div className="bg-blue-100 dark:bg-blue-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
          <Bell className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Не нашли то, что искали?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Мы сообщим, когда появится байк вашей мечты или цена на этот снизится.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
              <Check className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">Заявка принята!</h4>
            <p className="text-gray-500 mt-2">Охотник уже начал поиск.</p>
          </motion.div>
        ) : (
          <motion.form 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit} 
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Бренд</Label>
                <Input 
                  id="brand" 
                  value={brand} 
                  onChange={(e) => setBrand(e.target.value)} 
                  placeholder="Specialized" 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Модель</Label>
                <Input 
                  id="model" 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)} 
                  placeholder="Tarmac SL7" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Максимальная цена (€)</Label>
              <Input 
                id="price" 
                type="number"
                value={maxPrice} 
                onChange={(e) => setMaxPrice(e.target.value)} 
                placeholder="2500" 
              />
            </div>

            <div className="space-y-2">
              <Label>Куда отправить уведомление?</Label>
              <div className="flex gap-2 mb-2">
                <Button 
                  type="button" 
                  variant={contactMethod === 'email' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setContactMethod('email')}
                >
                  Email
                </Button>
                <Button 
                  type="button" 
                  variant={contactMethod === 'telegram' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setContactMethod('telegram')}
                >
                  Telegram
                </Button>
              </div>
              <Input 
                id="contact" 
                value={contactValue} 
                onChange={(e) => setContactValue(e.target.value)} 
                placeholder={contactMethod === 'email' ? 'name@example.com' : '@username'} 
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Отправка...' : 'Подписаться на поиск'}
            </Button>

            <LegalConsentFields value={legalConsent} onChange={setLegalConsent} />
            
            {status === 'error' && (
              <p className="text-red-500 text-sm text-center">{errorMessage}</p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};
