const withResolvers = () => {
  let resolve, reject, cancel;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  cancel = (reason) => {
    reject(reason);
  };

  return { promise, resolve, reject, cancel };
};
module.exports = withResolvers