console.log('Loaded service worker!11');

self.addEventListener('push', ev => {
  const data = ev.data.json();
  console.log('Got push', data);
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'http://mongoosejs.com/docs/images/mongoose5_62x30_transparent.png',
    sound:"/notify.mp3",
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction:true,
    tag:"my-tag",
    silent:false
  });

});