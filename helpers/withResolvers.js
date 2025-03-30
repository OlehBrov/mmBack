// const withResolvers = () => {
//   let resolve, reject, cancel;
//   const promise = new Promise((res, rej) => {
//     resolve = res;
//     reject = rej;
//   });
  
//   cancel = (reason) => {
//     reject(reason);
//   };

//   return { promise, resolve, reject, cancel };
// };
// module.exports = withResolvers
function withResolvers() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  let called = false;
  return {
    promise,
    resolve: (val) => {
      if (!called) {
        called = true;
        resolve(val);
      }
    },
    reject: (err) => {
      if (!called) {
        called = true;
        reject(err);
      }
    },
    cancel: (err) => {
      if (!called) {
        called = true;
        reject(err instanceof Error ? err : new Error(err));
      }
    },
  };
}



module.exports = withResolvers;