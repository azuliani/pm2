
process.on('unhandledRejection', function(reason) {
  console.log('handled rejection: ' + reason.message);
});

setTimeout(function() {
  Promise.reject(new Error('Handledla'));
}, 1000);

setInterval(function() {
}, 1000);
