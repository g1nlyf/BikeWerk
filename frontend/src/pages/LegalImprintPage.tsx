import * as React from 'react';

import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { LEGAL_DOCS_EFFECTIVE_DATE, LEGAL_DOCS_VERSION } from '@/lib/legal';

export default function LegalImprintPage() {
  return (
    <LegalPageLayout
      title="Реквизиты и юридическая информация (Imprint)"
      subtitle={`Версия: ${LEGAL_DOCS_VERSION}. Действует с ${LEGAL_DOCS_EFFECTIVE_DATE}.`}
    >
      <h2>1. Поставщик услуг (Provider)</h2>
      <p>
        BikeWerk (Kleinunternehmen, Germany).
      </p>
      <ul>
        <li>Владелец/предприниматель: Vladislav Sokolov.</li>
        <li>Адрес: Marburg, Germany.</li>
        <li>Email: <a href="mailto:hello@bikewerk.eu">hello@bikewerk.eu</a>.</li>
        <li>Телефон: <a href="tel:+491747032119">+49 174 703 2119</a>.</li>
        <li>
          Telegram:
          {' '}
          <a href="https://t.me/BikeWerk" target="_blank" rel="noreferrer">@BikeWerk</a>.
        </li>
      </ul>

      <h2>2. Юридически значимые сообщения</h2>
      <p>
        Юридически значимые сообщения (претензии, запросы, уведомления об отзыве согласия, запросы субъекта данных)
        направляйте на <a href="mailto:hello@bikewerk.eu">hello@bikewerk.eu</a>. Мы можем запросить подтверждение личности,
        если это требуется для предотвращения неправомерного раскрытия данных/информации.
      </p>

      <h2>3. Сведения для клиентов из ЕС/ЕЭЗ и Испании</h2>
      <p>
        Если к отношениям применимо право Испании, информация о поставщике услуг предоставляется, среди прочего, в соответствии
        с Ley 34/2002 (LSSI-CE), включая требования об общей информации (Art. 10) и правила по использованию cookie (Art. 22).
      </p>

      <h2>4. Ответственность за контент и ссылки</h2>
      <p>
        Мы принимаем разумные меры по актуальности информации на сайте. Сайт может содержать ссылки на внешние ресурсы;
        за содержание внешних ресурсов мы не отвечаем, если иное не предусмотрено императивными нормами применимого права.
      </p>

      <h2>5. Интеллектуальная собственность</h2>
      <p>
        Материалы сайта (тексты, дизайн, интерфейсные элементы, логотипы, базы данных и т.д.) охраняются законодательством об
        интеллектуальной собственности. Использование материалов допускается только в пределах, прямо разрешенных применимым правом
        или с согласия правообладателя.
      </p>

      <h2>6. Нормативные ссылки</h2>
      <ul>
        <li>
          EU: <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noreferrer">GDPR (Regulation (EU) 2016/679)</a>.
        </li>
        <li>
          EU: <a href="https://eur-lex.europa.eu/eli/dir/2002/58/oj" target="_blank" rel="noreferrer">ePrivacy Directive 2002/58/EC</a>.
        </li>
        <li>
          Spain: <a href="https://www.boe.es/eli/es/l/2002/07/11/34/con" target="_blank" rel="noreferrer">Ley 34/2002 (LSSI-CE)</a>.
        </li>
      </ul>
    </LegalPageLayout>
  );
}
