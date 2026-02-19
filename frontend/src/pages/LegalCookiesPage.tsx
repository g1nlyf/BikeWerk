import * as React from 'react';

import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCS_EFFECTIVE_DATE, LEGAL_DOCS_VERSION, openCookieSettings } from '@/lib/legal';

export default function LegalCookiesPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      subtitle={`Версия: ${LEGAL_DOCS_VERSION}. Действует с ${LEGAL_DOCS_EFFECTIVE_DATE}.`}
    >
      <h2>1. Что такое cookie</h2>
      <p>
        Cookie и аналогичные технологии (включая localStorage/sessionStorage) — это данные, которые сохраняются на устройстве
        пользователя и могут использоваться для работы сайта, сохранения настроек, аналитики и маркетинга (только при наличии
        соответствующего согласия).
      </p>

      <h2>2. Категории cookie на сайте</h2>
      <ul>
        <li><strong>Необходимые:</strong> обязательны для работы сайта, авторизации и оформления заявок.</li>
        <li><strong>Аналитика:</strong> собирают обезличенные метрики использования и производительности.</li>
        <li><strong>Маркетинг:</strong> используются для оценки рекламных каналов и персонализации предложений.</li>
      </ul>

      <h2>3. Управление согласием</h2>
      <p>
        При первом посещении отображается баннер cookie. Пользователь может принять все категории, оставить только
        необходимые или настроить категории отдельно. Изменить выбор можно в любой момент через кнопку
        «Настройки cookie» в футере.
      </p>
      <p>
        Также вы можете открыть настройки прямо со страницы:
        {' '}
        <button type="button" onClick={openCookieSettings} className="underline underline-offset-2">
          открыть настройки cookie
        </button>
        .
      </p>

      <h2>4. Какие идентификаторы используются на сайте</h2>
      <ul>
        <li><strong>Настройки согласия cookie:</strong> localStorage key <code>bikewerk_cookie_consent_v1</code>.</li>
        <li><strong>Локальный профиль интересов (аналитика):</strong> localStorage key <code>eubike_user_dna</code> (используется только при согласии на аналитику).</li>
        <li><strong>Технические идентификаторы сессии/метрик:</strong> могут храниться локально и/или передаваться на сервер (только при согласии на аналитику).</li>
      </ul>

      <h2>5. Правовые основания</h2>
      <ul>
        <li>ЕС/ЕЭЗ: Art. 5(3) ePrivacy Directive и требования GDPR к согласию (в т.ч. Art. 6(1)(a), Art. 7 GDPR) — в применимой части.</li>
        <li>Испания: Ley 34/2002 (LSSI-CE), в т.ч. Art. 22 (cookie) — в применимой части.</li>
        <li>РФ: 152-ФЗ, 149-ФЗ (в применимой части).</li>
      </ul>

      <h2>6. Срок хранения</h2>
      <p>
        Срок хранения cookie зависит от категории и технической необходимости. Для аналитических и маркетинговых
        категорий срок ограничивается разумным периодом и может быть сброшен при отзыве согласия.
      </p>

      <h2>7. Отзыв согласия и отключение в браузере</h2>
      <p>
        Пользователь также может ограничить cookie через настройки браузера. Отключение необходимых cookie может
        повлиять на корректную работу сайта.
      </p>

      <h2>8. Нормативные ссылки (не исчерпывающие)</h2>
      <ul>
        <li>
          ЕС/ЕЭЗ:
          {' '}
          <a href="https://eur-lex.europa.eu/eli/dir/2002/58/oj" target="_blank" rel="noreferrer">ePrivacy Directive 2002/58/EC</a>
          {', '}
          <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noreferrer">GDPR (Regulation (EU) 2016/679)</a>
          .
        </li>
        <li>
          Испания:
          {' '}
          <a href="https://www.boe.es/eli/es/l/2002/07/11/34/con" target="_blank" rel="noreferrer">Ley 34/2002 (LSSI-CE)</a>
          {', '}
          Art. 22.
        </li>
      </ul>
    </LegalPageLayout>
  );
}
