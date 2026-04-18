import { OkalitGraphqlService, service, gql } from '@okalit/core';

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
    return this.query(gql`
      query GetRicks { characters(page: 2, filter: { name: "rick" }) { results { name } } }
    `);
  }
}
