import * as React from 'react';
import { Link } from 'react-router-dom';

import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCS_EFFECTIVE_DATE, LEGAL_DOCS_VERSION, LEGAL_DOWNLOADS, LEGAL_ROUTES } from '@/lib/legal';

const documents = [
  {
    to: LEGAL_ROUTES.terms,
    title: 'Публичная оферта и условия сервиса',
    description: 'Права и обязанности сторон, порядок оформления, оплаты, отмен и возвратов.',
    download: LEGAL_DOWNLOADS.termsPdf,
  },
  {
    to: LEGAL_ROUTES.privacy,
    title: 'Политика конфиденциальности',
    description: 'Какие данные мы обрабатываем, зачем, как храним и кому передаем.',
    download: LEGAL_DOWNLOADS.privacyPdf,
  },
  {
    to: LEGAL_ROUTES.consent,
    title: 'Согласие на обработку персональных данных',
    description: 'Отдельное согласие для выполнения требований 152-ФЗ и GDPR (в применимой части).',
    download: LEGAL_DOWNLOADS.consentPdf,
  },
  {
    to: LEGAL_ROUTES.cookies,
    title: 'Cookie Policy',
    description: 'Категории cookie/аналогичных технологий, цели обработки и порядок управления согласием.',
    download: LEGAL_DOWNLOADS.cookiesPdf,
  },
  {
    to: LEGAL_ROUTES.imprint,
    title: 'Реквизиты и юридическая информация (Imprint)',
    description: 'Сведения об операторе/поставщике услуг и контакт для юридически значимых сообщений.',
    download: LEGAL_DOWNLOADS.imprintPdf,
  },
  {
    to: LEGAL_ROUTES.refunds,
    title: 'Отмены и возвраты',
    description: 'Порядок отмены заявки на разных стадиях исполнения и правила расчетов по возвратам.',
    download: LEGAL_DOWNLOADS.refundsPdf,
  },
  {
    to: LEGAL_ROUTES.sanctions,
    title: 'Санкционный и экспортный комплаенс',
    description: 'Проверка ограничений, право запросить документы и отказать/прекратить обслуживание.',
    download: LEGAL_DOWNLOADS.sanctionsPdf,
  },
];

export default function LegalDocumentsPage() {
  return (
    <LegalPageLayout
      title="Юридический центр BikeWerk"
      subtitle={`Версия документов: ${LEGAL_DOCS_VERSION}. Дата вступления в силу: ${LEGAL_DOCS_EFFECTIVE_DATE}.`}
    >
      <h2>1. Оператор и контакты</h2>
      <p>
        BikeWerk (Kleinunternehmen, Germany). Владелец: Vladislav Sokolov. Адрес: Marburg, Germany. Телефон:
        {' '}
        <a href="tel:+491747032119">+49 174 703 2119</a>, Telegram:
        {' '}
        <a href="https://t.me/BikeWerk" target="_blank" rel="noreferrer">@BikeWerk</a>.
      </p>
      <p>
        Для юридически значимых сообщений и запросов по персональным данным используйте email:
        {' '}
        <a href="mailto:hello@bikewerk.eu">hello@bikewerk.eu</a>.
      </p>

      <h2>2. Документы и скачивание</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {documents.map((item) => (
          <div key={item.to} className="rounded-2xl border border-zinc-200 p-4 transition hover:border-zinc-400 hover:bg-zinc-50">
            <Link to={item.to} className="no-underline">
              <div className="text-base font-semibold text-zinc-900">{item.title}</div>
              <div className="mt-2 text-sm text-zinc-600">{item.description}</div>
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link to={item.to} className="underline underline-offset-2">Открыть</Link>
              <a href={item.download} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                Скачать PDF
              </a>
            </div>
          </div>
        ))}
      </div>

      <h2>3. Нормативная основа (RU + EU/Spain)</h2>
      <ul>
        <li>
          РФ (в применимой части):
          {' '}
          <a href="https://www.consultant.ru/document/cons_doc_LAW_5142/" target="_blank" rel="noreferrer">ГК РФ</a>
          {' '}
          (оферта/акцепт),
          {' '}
          <a href="https://www.consultant.ru/document/cons_doc_LAW_61801/" target="_blank" rel="noreferrer">152-ФЗ</a>
          {' '}
          «О персональных данных»,
          {' '}
          <a href="https://www.consultant.ru/document/cons_doc_LAW_61798/" target="_blank" rel="noreferrer">149-ФЗ</a>
          {' '}
          «Об информации»,
          {' '}
          <a href="https://www.consultant.ru/document/cons_doc_LAW_58968/" target="_blank" rel="noreferrer">38-ФЗ</a>
          {' '}
          «О рекламе»,
          {' '}
          <a href="https://www.consultant.ru/document/cons_doc_LAW_305/" target="_blank" rel="noreferrer">Закон РФ 2300-1</a>
          {' '}
          «О защите прав потребителей».
        </li>
        <li>
          ЕС/ЕЭЗ (в применимой части):
          {' '}
          <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noreferrer">GDPR (Regulation (EU) 2016/679)</a>
          {', '}
          <a href="https://eur-lex.europa.eu/eli/dir/2002/58/oj" target="_blank" rel="noreferrer">ePrivacy Directive 2002/58/EC</a>
          {' '}
          (cookie),
          {' '}
          <a href="https://eur-lex.europa.eu/eli/dir/2011/83/oj" target="_blank" rel="noreferrer">Directive 2011/83/EU</a>
          {' '}
          (дистанционные договоры, преддоговорная информация и право отказа).
        </li>
        <li>
          Испания (в применимой части):
          {' '}
          <a href="https://www.boe.es/eli/es/l/2002/07/11/34/con" target="_blank" rel="noreferrer">Ley 34/2002 (LSSI-CE)</a>
          {' '}
          (в т.ч. Art. 10 и Art. 22),
          {' '}
          <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555" target="_blank" rel="noreferrer">Real Decreto Legislativo 1/2007 (TRLGDCU)</a>
          .
        </li>
      </ul>

      <h2>4. Где применяются согласия</h2>
      <ul>
        <li>При отправке заявок, сообщений, бронирования и регистрации аккаунта.</li>
        <li>При включении аналитических и маркетинговых cookie через баннер/настройки cookie.</li>
      </ul>

      <h2>5. Важно</h2>
      <p>
        Документы задают юридическую рамку сервиса и не заменяют индивидуальную юридическую консультацию. Императивные
        нормы права и права потребителей применяются независимо от формулировок документов.
      </p>
    </LegalPageLayout>
  );
}
