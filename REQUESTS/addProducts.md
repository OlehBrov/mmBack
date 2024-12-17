route: /api/products/add

request: POST

Додавання товарів БД кіоску. Якщо товар вжу існує - дані перезапишуться, якщо товару не існує - він буде доданий.
Пошук товару здійснюється по штрих-коду

Обробник приймає масив товарів у форматі JSON

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

[{
  "product_name":"<String> --Назва товару--",
  "product_code":  "<String> --Код товару з 1С--", 
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
  "exposition_term":"<Int> --Кількість днів, строк реалізації товару (для того, що швидко псується), для застосування знижок--",                                      
  "sale_id":"<Int> --Id акції, яку необхіжно затосувати до товару. Товар без акції - id = 0",                                                
  "discount_price_1":"<float> --Не передається--",                                      
  "discount_price_2":"<float> --Не передається--",                                       
  "discount_price_3":"<float> --Не передається--",                                       
  "updatedAt":"<DateTime> --Не передається--",                                              
  "combo_id":"<Int> --Не передається--",
  "child_product_barcode": "<String> --Штрихкод 'парного' товару для акції Комбо. Обовязково передається, якщо товара акція id = 7 (Комбо)--"                                           
  
}]