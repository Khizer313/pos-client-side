import { gql } from "@apollo/client";

// Create full sale
export const CREATE_SALE = gql`
  mutation CreateSale($createSaleInput: CreateSaleInput!) {
    createSale(createSaleInput: $createSaleInput) {
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

// Update sale
export const UPDATE_SALE = gql`
  mutation UpdateSale($saleId: Int!, $updateSaleInput: UpdateSaleInput!) {
    updateSale(saleId: $saleId, updateSaleInput: $updateSaleInput) {
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

// Delete sale
export const DELETE_SALE = gql`
  mutation DeleteSale($saleId: Int!) {
    deleteSale(saleId: $saleId) {
      success
      message
    }
  }
`;
