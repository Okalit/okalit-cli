import { OkalitService, service } from '@okalit/core';

@service('user')
export class UserService extends OkalitService {
  constructor() {
    super();
    this.configure({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      cache: true,
      cacheTTL: 60_000,
    });
  }

  getUsers() {
    return this.get('/users');
  }

  getUserById(id) {
    return this.get(`/users/${id}`);
  }

  createUser(data) {
    return this.post('/users', data);
  }

  updateUser(id, data) {
    return this.put(`/users/${id}`, data);
  }

  deleteUser(id) {
    return this.delete(`/users/${id}`);
  }
}
