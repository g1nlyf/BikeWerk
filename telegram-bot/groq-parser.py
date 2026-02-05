#!/usr/bin/env python3
"""
Groq-powered Kleinanzeigen Parser
Парсер объявлений Kleinanzeigen с использованием Groq API
"""

import os
import sys
import json
import requests
from bs4 import BeautifulSoup
from groq import Groq
import argparse
from typing import Dict, Any, Optional

# Настройка кодировки для Windows
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

class GroqKleinanzeigenParser:
    def __init__(self, api_key: str):
        """Инициализация парсера с API ключом Groq"""
        self.client = Groq(api_key=api_key)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def fetch_page_content(self, url: str) -> Optional[str]:
        """Получение HTML содержимого страницы"""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Ошибка при загрузке страницы: {e}", file=sys.stderr)
            return None
    
    def clean_html_for_ai(self, html: str) -> str:
        """Очистка HTML для отправки в AI"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Удаляем ненужные элементы
        for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
            element.decompose()
        
        # Находим основной контент объявления
        main_content = soup.find('article') or soup.find('main') or soup.find('div', class_='ad-details')
        
        if main_content:
            return main_content.get_text(separator=' ', strip=True)
        else:
            # Если не нашли основной контент, берем весь текст
            return soup.get_text(separator=' ', strip=True)[:5000]  # Ограничиваем размер
        
        return content
    
    def clean_json_response(self, json_text: str) -> str:
        """Очистка JSON ответа от распространенных ошибок форматирования"""
        import re
        
        # Удаляем лишние пробелы и переносы строк
        json_text = json_text.strip()
        
        # Исправляем распространенные ошибки в JSON
        # 1. Убираем trailing commas перед закрывающими скобками
        json_text = re.sub(r',(\s*[}\]])', r'\1', json_text)
        
        # 2. Исправляем одинарные кавычки на двойные (если они не внутри строк)
        json_text = re.sub(r"'([^']*)':", r'"\1":', json_text)
        json_text = re.sub(r':\s*\'([^\']*)\'\s*([,}])', r': "\1"\2', json_text)
        
        # 3. Экранируем неэкранированные кавычки внутри строк
        def escape_quotes_in_strings(match):
            content = match.group(1)
            # Экранируем неэкранированные кавычки
            content = content.replace('\\"', '___ESCAPED_QUOTE___')
            content = content.replace('"', '\\"')
            content = content.replace('___ESCAPED_QUOTE___', '\\"')
            return f'"{content}"'
        
        # Применяем экранирование к строковым значениям
        json_text = re.sub(r'"([^"]*(?:\\.[^"]*)*)"', escape_quotes_in_strings, json_text)
        
        # 4. Убираем комментарии (если есть)
        json_text = re.sub(r'//.*?\n', '\n', json_text)
        json_text = re.sub(r'/\*.*?\*/', '', json_text, flags=re.DOTALL)
        
        # 5. Исправляем неправильные null значения
        json_text = re.sub(r':\s*None\b', ': null', json_text)
        json_text = re.sub(r':\s*True\b', ': true', json_text)
        json_text = re.sub(r':\s*False\b', ': false', json_text)
        
        # 6. Убираем лишние запятые в конце объектов/массивов
        json_text = re.sub(r',(\s*[}\]])', r'\1', json_text)
        
        return json_text
    
    def attempt_json_repair(self, broken_json: str) -> str:
        """Попытка восстановления сильно поврежденного JSON"""
        import re
        
        try:
            # Создаем базовую структуру JSON
            base_structure = {
                "title": None,
                "brand": None,
                "model": None,
                "price": None,
                "condition": None,
                "conditionRating": 8,
                "frameSize": None,
                "category": None,
                "bikeType": None,
                "location": None,
                "description": None,
                "isNegotiable": False,
                "deliveryOption": None,
                "seller": {
                    "name": None,
                    "type": None,
                    "badges": [],
                    "memberSince": None,
                    "rating": None
                }
            }
            
            # Пытаемся извлечь значения из поврежденного JSON
            for key in base_structure.keys():
                if key == "seller":
                    continue  # Обрабатываем отдельно
                    
                # Ищем значение для ключа
                pattern = rf'"{key}"\s*:\s*([^,}}\]]+)'
                match = re.search(pattern, broken_json)
                if match:
                    value = match.group(1).strip()
                    # Очищаем значение
                    if value.startswith('"') and value.endswith('"'):
                        base_structure[key] = value[1:-1]
                    elif value.lower() == 'null':
                        base_structure[key] = None
                    elif value.lower() == 'true':
                        base_structure[key] = True
                    elif value.lower() == 'false':
                        base_structure[key] = False
                    elif value.isdigit():
                        base_structure[key] = int(value)
                    else:
                        try:
                            base_structure[key] = float(value)
                        except ValueError:
                            base_structure[key] = value.strip('"\'')
            
            return json.dumps(base_structure, ensure_ascii=False)
            
        except Exception as e:
            print(f"Ошибка при восстановлении JSON: {e}", file=sys.stderr)
            return None
    
    def parse_with_groq(self, content: str, url: str) -> Dict[str, Any]:
        """Парсинг содержимого с помощью Groq AI"""
        
        prompt = f"""
Проанализируй это объявление о продаже велосипеда с немецкого сайта Kleinanzeigen и извлеки следующую информацию в СТРОГО ВАЛИДНОМ JSON формате.

КРИТИЧЕСКИ ВАЖНО ДЛЯ JSON ФОРМАТА: 
- Возвращай ТОЛЬКО валидный JSON, без дополнительного текста, без markdown блоков
- Используй ТОЛЬКО двойные кавычки для всех строк
- НЕ используй одинарные кавычки НИКОГДА
- НЕ добавляй комментарии в JSON
- НЕ добавляй запятые после последнего элемента в объектах и массивах
- Экранируй все специальные символы в строках (кавычки, переносы строк)
- Используй null вместо None, true/false вместо True/False
- Если информация неизвестна - ставь null
- НЕ придумывай данные!
- Проверь, что JSON начинается с {{ и заканчивается на }}
- Убедись, что все скобки и кавычки закрыты правильно

{{
    "title": "полное название объявления",
    "brand": "бренд велосипеда (например: Trek, Specialized, Giant, Cube, Scott) или null",
    "model": "модель велосипеда или null",
    "price": "цена в евро (только число, без символов) или null",
    "condition": "состояние (neu, sehr gut, gut, befriedigend, ausreichend) или null",
    "conditionRating": "оценка состояния от 1 до 10 (число)",
    "frameSize": "размер рамы в см (только число) или null",
    "category": "тип велосипеда (Mountainbike, Rennrad, Citybike, E-Bike, Trekkingbike, BMX, Kinderfahrrad) или null",
    "bikeType": "подкатегория (Cross Country, Enduro, Downhill, Gravel, Touring, Urban, etc.) или null",
    "location": "город/регион или null",
    "description": "краткое описание на немецком языке",
    "isNegotiable": true/false (есть ли VB - Verhandlungsbasis),
    "deliveryOption": "способ доставки (Versand möglich, Nur Abholung, etc.) или null",
    "seller": {{
        "name": "имя продавца или null",
        "type": "тип продавца (Privater Nutzer, Händler, Gewerblicher Anbieter) или null",
        "badges": ["список значков/статусов продавца или пустой массив"],
        "memberSince": "дата регистрации (например: 09.12.2023) или null",
        "rating": "рейтинг продавца если указан или null"
    }}
}}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА АНАЛИЗА:

1. ГОД ВЫПУСКА vs ДРУГИЕ ДАТЫ:
   - "Baujahr 2020" = год выпуска 2020
   - "gekauft 2020" = куплен в 2020 (НЕ год выпуска!)
   - "letztes Service 2024" = ТО в 2024 (НЕ год выпуска!)
   - "Inspektion Frühjahr 2025" = ТО весной 2025 (НЕ год выпуска!)

2. РАЗМЕР РАМЫ:
   - Ищи "Rahmengröße", "RH", "Rahmen", "Größe"
   - КРИТИЧЕСКИ ВАЖНО: Сохраняй ТОЧНО то обозначение, которое указано в объявлении!
   - Если указано "M", "L", "S", "XS", "XL" - оставляй ИМЕННО ЭТИ БУКВЫ
   - Если указано в см (например "54cm", "52 cm") - оставляй с единицами измерения
   - Если указано в дюймах (например "19\"", "21 Zoll") - оставляй с единицами
   - НИКОГДА НЕ конвертируй размеры! НЕ переводи M в сантиметры!
   - Не путай с диаметром колес (26", 27.5", 29")!
   - Примеры правильного извлечения: "M" → "M", "54cm" → "54cm", "19\"" → "19\""

3. КОНТЕКСТНЫЙ АНАЛИЗ:
   - Внимательно читай весь текст
   - Различай технические характеристики от истории использования
   - Обращай внимание на ключевые слова и их контекст

4. СОСТОЯНИЕ:
   - Анализируй описание дефектов, износа, замен
   - Учитывай возраст и пробег
   - Обращай внимание на фразы о состоянии

5. ИЗВЛЕЧЕНИЕ ОПИСАНИЯ:
   - Ищи основной текст описания продавца в разделе "Beschreibung"
   - Извлекай полный текст описания, написанный продавцом
   - Включай информацию о состоянии, истории использования, причинах продажи
   - НЕ включай технические характеристики из таблиц
   - НЕ включай информацию о доставке и контактах
   - Пример: "verkaufe hier mein kaum gefahrenes Mondraker..." - это описание
   - Если описание отсутствует или очень короткое, используй null
   - Это обычно текст, который начинается с фраз типа "verkaufe", "biete", "zu verkaufen"
   - НЕ включай технические характеристики, списки компонентов, заголовки
   - Извлекай именно личное описание продавца о велосипеде
   - Пример правильного описания: "verkaufe hier mein kaum gefahrenes Mondraker..."
   - Если описание не найдено, используй null

6. ОБЯЗАТЕЛЬНЫЕ ПОЛЯ:
   - conditionRating: ВСЕГДА указывай число от 1 до 10 (по умолчанию 8)
   - bikeType: определи подкатегорию (Enduro, Cross Country, Trail, etc.)
   - seller: извлеки информацию о продавце из профиля (см. детали ниже)
   - condition: используй стандартные термины (sehr gut, gut, befriedigend)

7. ИНФОРМАЦИЯ О ПРОДАВЦЕ (seller):
   ОБЯЗАТЕЛЬНО ищи информацию о продавце в следующих HTML-элементах:
   
   - name: ТОЧНО ищи полное имя в:
     * Элементах с классом "text-body-regular-strong" внутри "userprofile-vip"
     * Ссылках с href="/s-bestandsliste.html?userId=" 
     * НЕ используй сокращения! Если видишь "Florian", НЕ сокращай до "Flo"
   
   - type: ищи ТОЧНЫЙ текст в span с классом "userprofile-vip-details-text":
     * "Privater Nutzer" (частное лицо)
     * "Händler" (дилер) 
     * "Gewerblicher Anbieter" (коммерческий продавец)
   
   - badges: ОБЯЗАТЕЛЬНО ищи ВСЕ значки в элементах с классом "userbadge-tag":
     * "TOP Zufriedenheit" или "TOP&nbsp;Zufriedenheit"
     * "Sehr freundlich" 
     * "Sehr zuverlässig"
     * "TOP Anbieter"
     * "Geprüfter Nutzer"
     Проверь классы: "userbadges-profile-rating", "userbadges-profile-friendliness", "userbadges-profile-reliability"
   
   - memberSince: ищи текст "Aktiv seit" + дата в span с классом "userprofile-vip-details-text"
     Пример: "Aktiv seit 17.03.2014" → извлеки "17.03.2014"
   
   - rating: ищи рейтинг рядом со значками или в элементах с "rating"
   
   ПРИМЕРЫ HTML СТРУКТУРЫ ПРОДАВЦА:
   Имя: <span>Florian</span> или <a>Florian</a> (ИЗВЛЕКАЙ ПОЛНОЕ ИМЯ ИЗ ПРОФИЛЯ, НЕ ИЗ ТЕКСТА ОПИСАНИЯ!)
   Тип: <span class="userprofile-vip-details-text">Privater Nutzer</span>
   Значки: 
     <span class="userbadge userbadges-profile-rating"><a class="userbadge-tag">TOP Zufriedenheit</a></span>
     <span class="userbadge userbadges-profile-friendliness"><a class="userbadge-tag">Sehr freundlich</a></span>
     <span class="userbadge userbadges-profile-reliability"><a class="userbadge-tag">Sehr zuverlässig</a></span>
   Дата регистрации: <span class="userprofile-vip-details-text">Aktiv seit 17.03.2014</span> (ИЗВЛЕКАЙ ДАТУ ИЗ ТЕКСТА "Aktiv seit"!)
   
   КРИТИЧЕСКИЕ ПРАВИЛА ИЗВЛЕЧЕНИЯ:
   - Для ИМЕНИ: Ищи в разделах профиля/пользователя, НЕ в описании объявления. Находи элементы рядом со значками/информацией о пользователе.
   - Для ДАТЫ РЕГИСТРАЦИИ: Ищи текст содержащий "Aktiv seit" за которым следует дата в формате ДД.ММ.ГГГГ.
   - Извлекай ТОЧНУЮ дату из паттерна "Aktiv seit ДД.ММ.ГГГГ".
   
   КРИТИЧЕСКИ ВАЖНО: 
   - НЕ сокращай имена! 
   - Ищи ВСЕ значки в разных span элементах
   - Проверяй несколько вариантов классов для каждого поля
   - Ищи значки в элементах содержащих класс "userbadge"
   - Извлекай текст из вложенных <a> тегов внутри элементов значков
   - Если не найдено - используй null, НЕ придумывай!

8. ОЦЕНКА СОСТОЯНИЯ (conditionRating):
- 10: "wie neu", "neuwertig", "perfekter Zustand", "keine Mängel"
- 9: "sehr guter Zustand", "kaum benutzt", "minimale Gebrauchsspuren"
- 8: стандартная оценка при отсутствии особых упоминаний
- 7: "kleine Kratzer", "leichte Gebrauchsspuren", "kleinere Mängel"
- 6: "sichtbare Schäden", "Reparatur nötig", "größere Mängel"
- 5 и ниже: "schlechter Zustand", "viele Defekte", "Generalüberholung nötig"

Если какая-то информация не найдена, используй null для строк и чисел, false для boolean.

Текст объявления:
{content[:4000]}

ОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО ВАЛИДНЫМ JSON БЕЗ ДОПОЛНИТЕЛЬНОГО ТЕКСТА!
Пример правильного формата:
{{"title": "Велосипед", "brand": "Trek", "price": 500, "condition": null}}

URL: {url}

Ответь ТОЛЬКО JSON без дополнительных комментариев.
"""

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model="llama-3.1-8b-instant",  # Используем актуальную быструю модель Groq
                temperature=0.1,
                max_tokens=1000
            )
            
            response_text = chat_completion.choices[0].message.content.strip()
            
            # Более надежная очистка ответа
            if '```json' in response_text:
                start = response_text.find('```json') + 7
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            elif '```' in response_text:
                start = response_text.find('```') + 3
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            
            # Ищем JSON объект в тексте
            if not response_text.startswith('{'):
                json_start = response_text.find('{')
                if json_start != -1:
                    response_text = response_text[json_start:]
            
            if not response_text.endswith('}'):
                json_end = response_text.rfind('}')
                if json_end != -1:
                    response_text = response_text[:json_end + 1]
            
            # Дополнительная очистка JSON
            response_text = self.clean_json_response(response_text)
            
            # Отладочная информация
            print(f"Очищенный JSON: {response_text[:200]}...", file=sys.stderr)
            
            try:
                parsed_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                # Попытка дополнительного исправления JSON
                print(f"Первая попытка парсинга не удалась: {e}", file=sys.stderr)
                print(f"Пытаюсь исправить JSON...", file=sys.stderr)
                
                # Попытка извлечь хотя бы основные поля
                fixed_json = self.attempt_json_repair(response_text)
                if fixed_json:
                    try:
                        parsed_data = json.loads(fixed_json)
                        print(f"JSON успешно исправлен!", file=sys.stderr)
                    except json.JSONDecodeError:
                        print(f"Не удалось исправить JSON", file=sys.stderr)
                        raise e
                else:
                    raise e
            
            # Добавляем URL к результату
            parsed_data['url'] = url
            parsed_data['success'] = True
            
            return parsed_data
            
        except json.JSONDecodeError as e:
            print(f"Ошибка парсинга JSON: {e}", file=sys.stderr)
            print(f"Ответ AI: {response_text}", file=sys.stderr)
            return self.create_error_response(url, f"JSON parsing error: {str(e)}")
        except Exception as e:
            print(f"Ошибка при обращении к Groq API: {e}", file=sys.stderr)
            return self.create_error_response(url, f"Groq API error: {str(e)}")
    
    def create_error_response(self, url: str, error: str) -> Dict[str, Any]:
        """Создание ответа об ошибке"""
        return {
            "url": url,
            "success": False,
            "error": error,
            "title": None,
            "brand": None,
            "model": None,
            "price": None,
            "condition": None,
            "conditionRating": 8,
            "frameSize": None,
            "category": None,
            "bikeType": None,
            "location": None,
            "description": None,
            "isNegotiable": False,
            "deliveryOption": None,
            "seller": {
                "name": None,
                "type": None,
                "badges": [],
                "memberSince": None,
                "rating": None
            }
        }
    
    def parse_url(self, url: str) -> Dict[str, Any]:
        """Основной метод парсинга URL"""
        print(f"Парсинг URL: {url}", file=sys.stderr)
        
        # Получаем содержимое страницы
        html_content = self.fetch_page_content(url)
        if not html_content:
            return self.create_error_response(url, "Failed to fetch page content")
        
        # Очищаем HTML
        clean_content = self.clean_html_for_ai(html_content)
        if not clean_content.strip():
            return self.create_error_response(url, "No content found on page")
        
        # Парсим с помощью Groq
        result = self.parse_with_groq(clean_content, url)
        
        print(f"Парсинг завершен: {'успешно' if result.get('success') else 'с ошибкой'}", file=sys.stderr)
        return result

def main():
    """Главная функция"""
    parser = argparse.ArgumentParser(description='Groq Kleinanzeigen Parser')
    parser.add_argument('url', help='URL объявления Kleinanzeigen')
    parser.add_argument('--api-key', help='Groq API ключ (или используйте переменную GROQ_API_KEY)')
    
    args = parser.parse_args()
    
    # Получаем API ключ
    api_key = args.api_key or os.getenv('GROQ_API_KEY')
    if not api_key:
        print("Ошибка: Не указан GROQ_API_KEY", file=sys.stderr)
        sys.exit(1)
    
    # Создаем парсер и обрабатываем URL
    groq_parser = GroqKleinanzeigenParser(api_key)
    result = groq_parser.parse_url(args.url)
    
    # Выводим результат в JSON формате с правильной кодировкой для Windows
    try:
        # Пытаемся вывести с Unicode
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except UnicodeEncodeError:
        # Если ошибка кодировки, выводим с ASCII escape-последовательностями
        print(json.dumps(result, ensure_ascii=True, indent=2))

if __name__ == "__main__":
    main()