import { gql } from "@apollo/client";

// Paginated sales list with full Sale object
export const GET_SALES_PAGINATED = gql`
  query GetSalesPaginated(
    $page: Int!
    $limit: Int!
    $search: String
    $status: String
    $paymentMethod: String
    $startDate: String
    $endDate: String
      $filters: [FilterInput!]
  $sort: SortInput
  ) {
    getSalesPaginated(
      page: $page
      limit: $limit
      search: $search
      status: $status
      paymentMethod: $paymentMethod
      startDate: $startDate
      endDate: $endDate
          filters: $filters
    sort: $sort
    ) {
      data {
        saleId
        customerId
        invoiceNo
        date
        status
        createdAt
        paymentMethod
        notes
        total
        items {
          productId
          productName
          ctn
          pieces
          quantity
          price
          total
        }
      }
      total
    }
  }
`;

// Get single sale by ID
export const GET_SALE_BY_ID = gql`
  query GetSaleById($saleId: Int!) {
    getSaleById(saleId: $saleId) {
      saleId
      customerId
      invoiceNo
      date
      status
      createdAt
      paymentMethod
      notes
      total
      items {
        productId
        productName
        ctn
        pieces
        quantity
        price
        total
      }
    }
  }
`;
