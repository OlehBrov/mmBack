const multer = require("multer");
const path = require("path");
const fs = require("fs");

const imagesDir = process.env.IMAGE_DIR;
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
const fileExtension = (string) => {
  
  return string.slice(string.lastIndexOf("."));
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename:  (req, file, cb) => {
      const extension =  fileExtension(file.originalname);
     
    const filename = `${req.body.fileName}${extension}` || file.originalname;
   
    cb(null, filename);
  },
});

const upload = multer({ storage });

module.exports = upload;
