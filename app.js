const express = require("express");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();

const storeRouter = require("./routes/storeRoutes");
const cartRouter = require("./routes/cartRoutes");
const adminAuthRouter = require("./routes/adminAuthRoutes");
const storeAuthRouter = require("./routes/storeAuthRoutes");
const adminManageRouter = require("./routes/adminManageRoutes");
const salesRouter = require('./routes/salesRoutes')
const proxyRecieptRouter = require('./routes/proxyRecieptRoutes')
const imagesDir = process.env.IMAGE_DIR;
const app = express();

app.use(express.static("public"));
// app.use(logger(formatsLogger));
app.use(cors());
app.use(express.json());
// app.use('api/admin', )
app.use("/api/auth/admin", adminAuthRouter);
app.use("/api/auth/store", storeAuthRouter);
app.use("/api/admin/stores", adminManageRouter);
app.use("/api/products", storeRouter);
app.use("/api/cart", cartRouter);
app.use("api/sales", salesRouter)
app.use("/api/reciept-proxy", proxyRecieptRouter)
app.use("/api/product-image", express.static(imagesDir))

app.use((err, req, res, next) => {
  console.log('error in app.use', err)
  const { status = 500, message = "Server error" } = err;
  res.status(status).json({
    message,
  });
});

module.exports = app;
