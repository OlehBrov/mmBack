const { json } = require("express");
const jwt = require("jsonwebtoken");
const { AUTH_TOKEN_SECRET_KEY, REFRESH_TOKEN_SECRET_KEY } = process.env;
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/db/dbConfig");
const { ctrlWrapper } = require("../helpers");

const { httpError } = require("../helpers/");

const refreshToken = async (req, res, next) => {
  console.log("refreshToken invoke", req.body);

  const { refreshToken } = req.body;
  if (!refreshToken) {
    return next(httpError(401, "Refresh token is required"));
  }

  let auth_id;
  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET_KEY);
    auth_id = decoded.auth_id;
  } catch (err) {
    console.error("Refresh token verification failed:", err.message);
    return next(httpError(401, "Invalid or expired refresh token"));
  }
  try {
    // Find the store in the database
    const prismaStore = await prisma.Store.findUnique({
      where: { auth_id },
    });

    if (!prismaStore) {
      console.error("Store not found for auth_id:", auth_id);
      return next(httpError(401, "Store not authorized"));
    }

    // Generate a new access token
    const token = jwt.sign(
      { auth_id: prismaStore.auth_id, store_id: prismaStore.store_id },
      AUTH_TOKEN_SECRET_KEY,
      { expiresIn: "1m" }
    );

    // Update the store with the new token
    const updatedStore = await prisma.Store.update({
      where: { auth_id },
      data: { token },
    });

    console.log(
      "Token refreshed successfully for store:",
      prismaStore.store_id
    );

    // Send the new token to the client
    res.json({
      message: "Token refreshed",
      token: updatedStore.token,
    });
  } catch (err) {
    console.error("Error during token refresh:", err.message);
    next(httpError(401, "Refresh Token Error"));
  }
};

const logInStore = async (req, res, next) => {
  console.log("logInStore invoke");
  const { login, password } = req.body;
  console.log("login", login);
  const store = await prisma.Store.findUnique({ where: { auth_id: login } });
  if (!store) {
    return httpError(401);
  }

  const checkPassword = await bcrypt.compare(password, store.password);

  if (!checkPassword) {
    return httpError(401);
  }
  const token = jwt.sign(
    { auth_id: store.auth_id, store_id: store.id },
    AUTH_TOKEN_SECRET_KEY,
    {
      expiresIn: "1m",
    }
  );
  const refreshToken = jwt.sign(
    { auth_id: store.auth_id, store_id: store.id },
    REFRESH_TOKEN_SECRET_KEY,
    { expiresIn: "1d" }
  );
  const updateStore = await prisma.Store.update({
    where: {
      auth_id: login,
    },
    data: {
      token: token,
    },
  });

  res.json({
    message: "success",
    store_id: updateStore.id,
    auth_id: updateStore.auth_id,
    token: updateStore.token,
    refreshToken,
    role: updateStore.role,
  });
};

const logoutStore = async (req, res, next) => {
  const { store_id } = req.store;

  const store = await prisma.Store.findUnique({
    where: { store_id: store_id },
  });
  if (!store) {
    next(httpError(401));
  }
  await prisma.Store.update({
    where: {
      store_id: store_id,
    },
    data: {
      token: "",
      isLoggedIn: false,
    },
  });
  res.status(200).json({
    message: "Logout success",
  });
};
module.exports = {
  logInStore: ctrlWrapper(logInStore),
  logoutStore: ctrlWrapper(logoutStore),
  refreshToken: ctrlWrapper(refreshToken),
};
