import { gql } from "@apollo/client";

export const GET_VARIATIONS_PAGINATED = gql`
  query GetVariationsPaginated(
    $page: Int!,
    $limit: Int!,
    $search: String,
    $status: String,
    $startDate: String,
    $endDate: String
  ) {
    variationsPaginated(
      page: $page,
      limit: $limit,
      search: $search,
      status: $status,
      startDate: $startDate,
      endDate: $endDate
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
