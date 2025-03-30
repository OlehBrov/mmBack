const NEW_PRODUCT_DATA_KEYS_DEFAULTS = {
    product_name: "",
	product_code: "",
	measure: "шт.",
	product_name_ru: null,
	product_name_ua: null,
	product_description: null,
	product_left: 0,
	product_image: "",
	product_price: null,
	product_discount: null,
	product_rating: null,
	product_lot: null,
	exposition_term: null,
	sale_id: 0,
    discount_price_1:null,
	discount_price_2: null,
	discount_price_3: null,
	updatedAt: null,
	combo_id: null,
	product_category: null,
	product_subcategory: null,
	is_VAT_Excise: false,
	excise_product: false,
	product_division: 0,
	is_new_product: false
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".webp", ".png"]
module.exports = {NEW_PRODUCT_DATA_KEYS_DEFAULTS, IMAGE_EXTENSIONS}