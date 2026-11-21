import { fetchHealthMessage } from './health-message.ts';

const status = document.querySelector('#database-status');
if (status) {
  void fetchHealthMessage().then((message) => {
    status.textContent = message;
  });
}
