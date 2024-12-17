# Додавання товарів

За цим маршрутом здійснюється додавання товару в кіоск.
Якщо товар в базі даних існує - будуть перезаписані усі передані поля.
Якщо товар відсутній у бфза даних - буде створено новий запис про товар.
Пошук товару, ідентифікація товару здійсюються за штрих-кодом (ШК)

маршрут **api/products/add**
метод **POST**

приймає JSON масив обєктів

Обовязкові поля:
"product_name"
"product_code"
"barcode"
"measure"
"product_name_ua"
"product_category"
"product_subcategory"
"product_left"
"product_price"
"exposition_term"
"sale_id"
"child_product_barcode" (в окремих випадках)

приклад:
[
{
"product_name":"<String> --Назва товару--",
"product_code": "<String> --Код товару з 1С--",
"barcode": "<String> --Штрихкод товару--",
"measure":"<String> --Одиниця виміру товару (шт.)",
"product_name_ru":"<String> --Назва товару--",
"product_name_ua":"<String> --Назва товару--",
"product_description":"<String> --Опис товару (склад, поживна цінність тощо),
"good_category":"<String> --Не передається--",
"product_category":"<Int> --Id категорії товару--",
"product_subcategory":"<Int> --Id підкатегорії товару--",
"product_left":"<float> --Кількість товарів, що додаються в ММ",
"product_image":"<String> --URL до зображення в локальному сходвищі ММ",
"product_price":"<float> --Ціна товару у вигляді десяткового дробу - 250.33",
"product_discount":"<float> --Не передається--",
"product_rating":"<float> --Не передається--",
"product_lot":"<Int> --Не передається--",
"exposition_term":"<Int> --Кількість днів, строк реалізації товару (для того, що швидко псується), для застосування знижок--. Можн бути NULL",
"sale_id":"<Int> --Id акції, яку необхіжно затосувати до товару. Товар без акції - id = 0",
"discount_price_1":"<float> --Не передається--",
"discount_price_2":"<float> --Не передається--",
"discount_price_3":"<float> --Не передається--",
"updatedAt":"<DateTime> --Не передається--",
"combo_id":"<Int> --Не передається--",
"child_product_barcode": "<String> --Штрихкод 'парного' товару для акції Комбо. Обовязково передається, якщо товара акція id = 7 (Комбо)--"
}
]

Дані про додавання товару (поставка товару) зберігаються у таблиці LoadProducts:
            {
            product_id: id доданого продукту,
            load_date: дата додавання,
            load_quantity: кількість доданого продукту,
            lotIsActive: - приймає значення true або false та вказує, чи відображати ці товари в кіоску,
            products_left: залишок продуктів,
            sale_id: id акції товару або 0, якщо товар без акції,
            child_product_barcode: штрихкод залежного продукту (наприклад в акції "комбо") || null,
            load_date_time: дата і час поставки,
            }

При додаванні продукту перевіряється папка з зображеннями. Якщо зображення відповідає штрихкоду - воно присвоюється продукту. 
Якщо зображення не знайдено - присвоюється дефолтне зображення.

# Продаж товару

При продажу товару кіоск робить **POST** запит з товарами з корзини за маршрутом **api/cart/buy**.
Дані про проданий товар додаються в таблицю **RemoveProducts**
В таблиці зберіаються дані про проданий товар, дані банківського терміналу, платіжні реквізити.
В таблиці вказується id типу списання товару "1" - продаж.
В таблиці **LoadProducts** відповідно зменшується кількість товару в колонці products_left, або ставиться 0. Якщо кількість товару 0 - 
поставка (лот) стає неактивним lotIsActive: false.


# Списання товару

Списання відбувається шляхом передання **POST** запиту на **api/products/withdraw**
Обробник приймає JSON масив у вигляді:
[
    {
        "barcode": <String> --Штрихкод товару--",
        "quantity": <String || Int> --Ключове слово "all" або кількість товару--",
        "limit": <String> --Ключове слово "not-last" або породній рядок--",
    },
    {
        "barcode": "5900617034786",
        "quantity": 5,
        "limit": ""
    }
]

"quantity" - вказується число товару для списання або ключове слово. У разі передання числа - система "списує" продукти, починаючи від найстарішого.
Відповідні записи про "списання" додаються в таблицю **RemoveProducts**, в таблиці вказується id типу списання товару "3" - списання
Якщо у параметр "limit" передано "not-last" - товари з останньої поставки не будуть видалені.
Якщо передати "quantity": "all" та "limit":"not-last" - будуть списані всі товари, крім останньої поставки. Якщо limit":"" - будуть списані всі товари.
В таблиці **LoadProducts**  зменшується кількість товару в колонці products_left, або ставиться 0. Якщо кількість товару 0 - 
поставка (лот) стає неактивним lotIsActive: false.

# Додавання зображень

Зображення передаються масивом обєктів **api/products/image** методом **POST**
[
    {
        "productImage": <String> --Base64 закодоване зображення--,
        "fileName": <String> --назва файлу у форматі штрих-коду, наприклад "8593893745841.webp"
    }
]

Кожне зображення зберігається в кіоску локально у папці "C:/mm-images"
Якщо імя файлу в папці вже існує - файл перезапишеться. Тобто для кожного ШК одночасно існує лише 1 зображення.
Посилання на зображення передається в таблицю **Products** у відповідний продукт, колонка product_image.

# Оновлення даних продукту

Обробник для збереження нових даних про продукт, які не повязані з додаванням або списанням товарів.
Маршрут **api/products/update**, метод **POST**
Приймає JSON масив обєктів.
Обовязковим є передавання ШК товару та даних, які необхідно оновити.
Система перевіряє наявність штрихкоду та перелік ключів. Якщо штрих-код не передано - помилка (400), якщо передано не існуючі поля для оновлення - помилка (400).
Якщо система відповіла 200 - дані тимчасово записані у файл. Коли кіоск перейде в режим очікування (коли користувач не взаємодіє з кіоском - дані зберігаються в БД, тимчасові дані видаляються)