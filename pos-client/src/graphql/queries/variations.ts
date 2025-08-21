import { gql } from "@apollo/client";

export const GET_VARIATIONS_PAGINATED = gql`
  query GetVariationsPaginated(
    $page: Int!,
    $limit: Int!,
    $search: String,
    $status: String
  ) {
    variationsPaginated(
      page: $page,
      limit: $limit,
      search: $search,
      status: $status
    ) {
      data {
        variationId
        name
        productAssigned
        pieces
        price
        status
        createdAt
      }
      total
    }
  }
`;
