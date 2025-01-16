const { ctrlWrapper } = require("../helpers");

const getReciept = async (req, res, next) => {
  console.log("getReciept invoked");
  const { id } = req.params;
  const response = await fetch(`https://kasa.vchasno.ua/c/${id}.json`);

  const data = await response.json(); // Parse JSON response
  res.status(200).json({ data, message: "Tax reciept" });
};

module.exports = {
  getReciept: ctrlWrapper(getReciept),
};
