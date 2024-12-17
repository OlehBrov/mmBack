roure: api/products/image

request: POST

body: JSON, array:
[

    {
        "productImage": base64 encoded,
        "fileName": "8593893745841.webp" // Filename - barcode + extension
    },
        {
        "productImage": base64 encoded,
        "fileName": "8593893745842.webp" // Filename - barcode + extension
    }
]