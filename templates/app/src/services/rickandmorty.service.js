import { OkalitGraphqlService, service } from '@okalit';

@service('rickandmorty')
export class RickAndMortyService extends OkalitGraphqlService {
  constructor() {
    super();
    this.configure({
      endpoint: 'https://rickandmortyapi.com/graphql',
      cache: true,
      cacheTTL: 120_000,
    });
  }

  getCharacters() {
    return this.query(`{ characters(page: 2, filter: { name: "rick" }) { results { name } } }`);
  }
}
