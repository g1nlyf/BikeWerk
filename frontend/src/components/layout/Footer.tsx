import * as React from 'react';
import { Link } from 'react-router-dom';

import { LEGAL_ROUTES, openCookieSettings } from '@/lib/legal';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-100">
      <div className="container mx-auto grid gap-10 px-6 py-8 md:grid-cols-4 md:px-12 md:py-12">
        <div className="flex flex-col gap-3">
          <div className="text-xl font-extrabold tracking-tight text-zinc-900">BikeWerk</div>
          <p className="text-sm leading-relaxed text-zinc-600">
            Подбор, выкуп и доставка велосипедов из Европы под ключ.
          </p>
          <p className="text-sm font-medium text-zinc-600">Marburg, Germany</p>
        </div>

        <div>
          <div className="mb-4 font-bold text-zinc-900">Навигация</div>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li><Link to="/catalog" className="hover:text-zinc-900">Каталог</Link></li>
            <li><Link to="/calculator" className="hover:text-zinc-900">Калькулятор</Link></li>
            <li><Link to="/sniper" className="hover:text-zinc-900">Снайпер</Link></li>
            <li><Link to="/about" className="hover:text-zinc-900">О компании</Link></li>
            <li><Link to="/faq" className="hover:text-zinc-900">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-bold text-zinc-900">Юридическая информация</div>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li><Link to={LEGAL_ROUTES.documents} className="hover:text-zinc-900">Юридический центр</Link></li>
            <li><Link to={LEGAL_ROUTES.terms} className="hover:text-zinc-900">Публичная оферта</Link></li>
            <li><Link to={LEGAL_ROUTES.privacy} className="hover:text-zinc-900">Политика конфиденциальности</Link></li>
            <li><Link to={LEGAL_ROUTES.consent} className="hover:text-zinc-900">Согласие на ПДн</Link></li>
            <li><Link to={LEGAL_ROUTES.cookies} className="hover:text-zinc-900">Cookie Policy</Link></li>
            <li><Link to={LEGAL_ROUTES.imprint} className="hover:text-zinc-900">Реквизиты (Imprint)</Link></li>
            <li><Link to={LEGAL_ROUTES.refunds} className="hover:text-zinc-900">Отмены и возвраты</Link></li>
            <li><Link to={LEGAL_ROUTES.sanctions} className="hover:text-zinc-900">Санкционный комплаенс</Link></li>
            <li>
              <button type="button" onClick={openCookieSettings} className="text-left hover:text-zinc-900">
                Настройки cookie
              </button>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-bold text-zinc-900">Контакты</div>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li><a href="mailto:hello@bikewerk.eu" className="hover:text-zinc-900">hello@bikewerk.eu</a></li>
            <li><a href="tel:+491747032119" className="hover:text-zinc-900">+49 174 703 2119</a></li>
            <li><a href="https://t.me/BikeWerk" target="_blank" rel="noreferrer" className="hover:text-zinc-900">Telegram @BikeWerk</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-200">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-zinc-500">
          © 2026 BikeWerk. Все права защищены.
        </div>
      </div>
    </footer>
  );
};
