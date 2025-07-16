/**
 * =================================================================
 * DHL Backup Solution - Create Shipment Payload Builder
 * Author: Joker & Gemini
 * Version: 17.3.0 (Paperless Trade Logic Update)
 * Description: This script collects all data from the ship.html form
 * and builds the correct root JSON payload for the DHL API.
 * =================================================================
 */

/**
 * Reads a file and converts it to a Base64 encoded string.
 * @param {File} file The file to encode.
 * @returns {Promise<string>} A promise that resolves with the Base64 string.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // result includes the "data:mime/type;base64," prefix, remove it
            resolve(reader.result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Gathers all data from the form and builds the complete JSON payload.
 * @returns {Promise<Object>} A promise that resolves with the shipment payload object.
 */
async function buildShipmentPayload() {
    // Helper function to get value from an element by ID
    const getVal = (id) => document.getElementById(id)?.value || '';
    
    const isDocument = document.getElementById('ship-type-document').classList.contains('active');
    const isPackage = document.getElementById('ship-type-package').classList.contains('active');
    const isPickupRequested = document.getElementById('pickup-yes-btn').classList.contains('active');
    const createInvoiceRequested = document.getElementById('create-invoice-btn').classList.contains('active');
    const receiverPaysTaxes = document.getElementById('receiver-pays-checkbox').checked;
    const isInsuranceRequested = document.getElementById('protect-shipment').checked;
    const isDocUploadRequested = document.getElementById('upload-documents-checkbox').checked;


    let payload = {};
    let valueAddedServices = [];

    const shipDate = isPickupRequested ? getVal('pickup-date') : getVal('ship-date');
    payload.plannedShippingDateAndTime = `${shipDate}T09:00:00GMT+07:00`;

    payload.productCode = isDocument ? 'D' : 'P';

    payload.accounts = [];
    payload.accounts.push({
        typeCode: "shipper",
        number: getVal('shipper-account')
    });

    if (isPackage && !receiverPaysTaxes) {
        const dutiesAccount = getVal('duties-account');
        if (dutiesAccount) {
            payload.accounts.push({
                typeCode: "duties-taxes",
                number: dutiesAccount
            });
        }
    }

    const getAddressDetails = (prefix) => {
        return {
            postalAddress: {
                postalCode: getVal(`${prefix}-postalcode`),
                cityName: getVal(`${prefix}-city`),
                countryCode: getVal(`${prefix}-country-value`),
                addressLine1: getVal(`${prefix}-address1`),
                addressLine2: getVal(`${prefix}-address2`) || undefined,
                addressLine3: getVal(`${prefix}-address3`) || undefined,
            },
            contactInformation: {
                fullName: getVal(`${prefix}-name`),
                companyName: getVal(`${prefix}-company`),
                phone: getVal(`${prefix}-phone`),
                email: getVal(`${prefix}-email`) || undefined,
            }
        };
    };

    payload.customerDetails = {
        shipperDetails: getAddressDetails('shipper'),
        receiverDetails: getAddressDetails('receiver')
    };
    
    payload.content = {
        packages: [], 
        unitOfMeasurement: "metric",
        isCustomsDeclarable: isPackage,
    };
    
    if (isDocument) {
        payload.content.description = getVal('document-description-input') || "Documents";
        
        payload.content.packages.push({
            weight: 0.5,
            dimensions: {
                length: 1,
                width: 38,
                height: 48
            }
        });
    }

    if (isPackage) {
        const lineItems = Array.from(document.querySelectorAll('#line-items-container .line-item'));
        
        if (lineItems.length > 1 && getVal('summarize-shipment')) {
            payload.content.description = getVal('summarize-shipment');
        } else if (lineItems.length > 0 && lineItems[0].querySelector('.item-description').value) {
            payload.content.description = lineItems[0].querySelector('.item-description').value;
        } else {
            payload.content.description = "Shipment details";
        }

        payload.content.incoterm = getVal('incoterm');
        
        if (isInsuranceRequested && getVal('insurance-value')) {
             payload.content.declaredValue = parseFloat(getVal('insurance-value'));
             payload.content.declaredValueCurrency = document.getElementById('insurance-currency').textContent;
        } else {
            let totalValue = 0;
            let currency = 'THB';
            if (lineItems.length > 0) {
                currency = lineItems[0].querySelector('.item-currency').value;
                lineItems.forEach(item => {
                    const quantity = parseInt(item.querySelector('.item-quantity')?.value, 10) || 0;
                    const value = parseFloat(item.querySelector('.item-value')?.value) || 0;
                    totalValue += value * quantity;
                });
            }
            payload.content.declaredValue = parseFloat(totalValue.toFixed(3));
            payload.content.declaredValueCurrency = currency;
        }

        payload.content.exportDeclaration = {
            lineItems: lineItems.map((item, index) => {
                const weight = parseFloat(item.querySelector('.item-weight').value) || 0;
                const commodityCodeValue = item.querySelector('.commodity-code').value;

                const lineItemObject = {
                    number: index + 1,
                    description: item.querySelector('.item-description').value,
                    price: parseFloat(item.querySelector('.item-value').value) || 0,
                    quantity: {
                        value: parseInt(item.querySelector('.item-quantity').value, 10) || 1,
                        unitOfMeasurement: item.querySelector('.item-units').value,
                    },
                    exportReasonType: "permanent",
                    manufacturerCountry: item.querySelector('.item-made-in').value,
                    weight: {
                        netValue: weight,
                        grossValue: weight,
                    },
                };

                if (commodityCodeValue) {
                    lineItemObject.commodityCodes = [{
                        typeCode: "inbound",
                        value: commodityCodeValue,
                    }];
                }

                return lineItemObject;
            }),
            invoice: {
                number: getVal('invoice-number'),
                date: shipDate,
            }
        };

        document.querySelectorAll('#package-pieces-container .package-piece-item').forEach(piece => {
            const quantity = parseInt(piece.querySelector('.piece-quantity').value, 10) || 1;
            const packageData = {
                weight: parseFloat(piece.querySelector('.piece-weight').value),
                dimensions: {
                    length: parseFloat(piece.querySelector('.piece-length').value),
                    width: parseFloat(piece.querySelector('.piece-width').value),
                    height: parseFloat(piece.querySelector('.piece-height').value),
                },
            };
            for (let i = 0; i < quantity; i++) {
                payload.content.packages.push(packageData);
            }
        });
    }

    const refInputId = isDocument ? 'shipment-reference-doc' : 'shipment-reference-pkg';
    const shipmentReference = getVal(refInputId);
    if (shipmentReference) {
        payload.customerReferences = [{
            typeCode: "CU",
            value: shipmentReference
        }];
    }

    // [MODIFIED] Separated logic for Paperless Trade and Document Upload
    const docUploader = document.getElementById('doc-uploader');

    // Add Paperless Trade (WY) service if user opts in, regardless of actual file upload.
    if (isDocUploadRequested) {
        valueAddedServices.push({ serviceCode: "WY" });
    }

    // Add document image content only if a file is actually uploaded.
    if (isDocUploadRequested && docUploader.files.length > 0) {
        const file = docUploader.files[0];
        const fileExtension = file.name.split('.').pop().toUpperCase();
        
        try {
            const base64Content = await fileToBase64(file);
            payload.documentImages = [{
                typeCode: "INV",
                imageFormat: fileExtension === 'JPG' ? 'JPEG' : fileExtension,
                content: base64Content,
            }];
        } catch (error) {
            console.error("Error encoding file to Base64:", error);
            alert("Could not process the uploaded file. Please try again.");
            return null;
        }
    }
    
    if (isInsuranceRequested) {
        if (isDocument) {
            valueAddedServices.push({ serviceCode: "IB" });
        }
        if (isPackage) {
            valueAddedServices.push({ 
                serviceCode: "II",
                value: parseFloat(getVal('insurance-value')),
                currency: document.getElementById('insurance-currency').textContent
            });
        }
    }

    if (isPickupRequested) {
        if (typeof timeSlider !== 'undefined' && timeSlider) {
            const sliderValues = timeSlider.get(); 
            const closeTimeInMinutes = parseFloat(sliderValues[1]);
            const hours = Math.floor(closeTimeInMinutes / 60);
            const minutes = Math.round(closeTimeInMinutes % 60);

            payload.pickup = {
                isRequested: true,
                closeTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
                location: getVal('pickup-location-select'),
                specialInstructions: [{
                    value: getVal('pickup-instructions') || ""
                }],
                pickupDetails: {
                    postalAddress: {
                        postalCode: getVal('pickup-postalcode'),
                        cityName: getVal('pickup-city'),
                        countryCode: getVal('shipper-country-value'), 
                        addressLine1: getVal('pickup-address1'),
                        addressLine2: getVal('pickup-address2') || undefined,
                        addressLine3: getVal('pickup-address3') || undefined,
                    },
                    contactInformation: {
                        phone: getVal('pickup-phone'),
                        companyName: getVal('pickup-company'),
                        fullName: getVal('pickup-name'),
                    }
                }
            };
        } else {
             console.error('DEBUG: timeSlider not found or is null. Using fallback pickup object.');
             payload.pickup = { isRequested: true };
        }
    } else {
        payload.pickup = { isRequested: false };
    }
    
    payload.outputImageProperties = {
        encodingFormat: "pdf",
        imageOptions: [
            {
                typeCode: "label",
                templateName: "ECOM26_84_A4_001",
                isRequested: true,
            },
			{
                typeCode: "waybillDoc",
                templateName: "ARCH_8X4_A4_002",
                isRequested: true,
            },
            {
                typeCode: "shipmentReceipt",
                isRequested: true,
                templateName: "SHIPRCPT_EN_001",
            }
        ],
		"splitInvoiceAndReceipt":true
    };

    if (isPackage && createInvoiceRequested) {
        const isProforma = document.getElementById('invoice-type-proforma').classList.contains('active');
        const invoiceType = isProforma ? "proforma" : "commercial";

        payload.outputImageProperties.imageOptions.push({
            typeCode: "invoice",
            invoiceType: invoiceType,
            isRequested: true,
        });
    }

    if (valueAddedServices.length > 0) {
        payload.valueAddedServices = valueAddedServices;
    }

    console.log("DEBUG: Final Payload:", payload);
    return payload;
}
