import { gql } from "@apollo/client";

// Create variation
export const CREATE_VARIATION = gql`
  mutation CreateVariation($createVariationInput: CreateVariationInput!) {
    createVariation(createVariationInput: $createVariationInput) {
      variationId
      name
      productAssigned
      pieces
      price
      status
      createdAt
    }
  }
`;

// Update variation
export const UPDATE_VARIATION = gql`
  mutation UpdateVariation($variationId: Int!, $updateVariationInput: CreateVariationInput!) {
    updateVariation(variationId: $variationId, updateVariationInput: $updateVariationInput) {
      variationId
      name
      productAssigned
      pieces
      price
      status
      createdAt
    }
  }
`;

// Delete variation
export const DELETE_VARIATION = gql`
  mutation RemoveVariation($variationId: Int!) {
    removeVariation(variationId: $variationId) {
      variationId
    }
  }
`;
