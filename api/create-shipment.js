/**
 * =================================================================
 * DHL Backup Solution - Create Shipment Payload Builder
 * Author: Joker & Gemini
 * Version: 1.0.0
 * Description: This script collects all data from the ship.html form
 * and builds the JSON payload for the DHL Create Shipment API.
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
    const getChecked = (id) => document.getElementById(id)?.checked || false;

    const isDocument = getChecked('ship-type-document');
    const isPackage = getChecked('ship-type-package');

    // =================================================================
    // 1. Initialize Main Payload Structure
    // =================================================================
    let payload = {
        // This is the main wrapper for the shipment request
    };

    // =================================================================
    // 2. Planned Shipping Date
    // =================================================================
    const shipDate = getVal('ship-date');
    // Assuming the time is always 09:00:00 Bangkok time for simplicity
    payload.plannedShippingDateAndTime = `${shipDate}T09:00:00 GMT+07:00`;

    // =================================================================
    // 3. Product Code
    // =================================================================
    payload.productCode = isDocument ? 'D' : 'P';

    // =================================================================
    // 4. Accounts Information
    // =================================================================
    payload.accounts = [];
    payload.accounts.push({
        typeCode: "shipper",
        number: getVal('shipper-account')
    });

    if (!getChecked('receiver-pays-checkbox')) {
        const dutiesAccount = getVal('duties-account');
        if (dutiesAccount) {
            payload.accounts.push({
                typeCode: "duties-taxes",
                number: dutiesAccount
            });
        }
    }

    // =================================================================
    // 5. Customer Details (Shipper & Receiver)
    // =================================================================
    const getAddressDetails = (prefix) => {
        return {
            postalAddress: {
                postalCode: getVal(`${prefix}-postalcode`),
                cityName: getVal(`${prefix}-city`),
                countryCode: getVal(`${prefix}-country-value`),
                addressLine1: getVal(`${prefix}-address1`),
                addressLine2: getVal(`${prefix}-address2`) || undefined, // Use undefined to omit empty fields
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
    
    // =================================================================
    // 6. Content Details
    // =================================================================
    payload.content = {
        packages: [], // This will be populated in section 8
        isCustomsDeclarable: isPackage,
        unitOfMeasurement: "metric",
    };

    if (isDocument) {
        payload.content.description = getVal('document-description-input');
    }

    if (isPackage) {
        const lineItems = Array.from(document.querySelectorAll('#line-items-container .line-item'));
        
        // Description logic
        if (lineItems.length > 1 && getVal('summarize-shipment')) {
            payload.content.description = getVal('summarize-shipment');
        } else if (lineItems.length > 0) {
            payload.content.description = lineItems[0].querySelector('.item-description').value;
        }

        // Currency
        payload.content.declaredValueCurrency = document.querySelector('.item-currency')?.value || 'THB';
        
        // Incoterm
        payload.content.incoterm = getVal('incoterm');

        // Export Declaration
        payload.content.exportDeclaration = {
            lineItems: lineItems.map((item, index) => {
                const weight = parseFloat(item.querySelector('.item-weight').value) || 0;
                return {
                    number: index + 1,
                    description: item.querySelector('.item-description').value,
                    price: parseFloat(item.querySelector('.item-value').value) || 0,
                    quantity: {
                        value: parseInt(item.querySelector('.item-quantity').value, 10) || 1,
                        unitOfMeasurement: item.querySelector('.item-units').value,
                    },
                    commodityCodes: [{
                        typeCode: "inbound",
                        value: item.querySelector('.commodity-code').value || undefined,
                    }],
                    exportReasonType: "permanent",
                    manufacturerCountry: item.querySelector('.item-made-in').value,
                    weight: {
                        netValue: weight,
                        grossValue: weight,
                    },
                };
            }),
            invoice: {
                number: getVal('invoice-number'),
                date: shipDate,
                totalNetWeight: parseFloat(document.getElementById('summary-total-weight-kg').textContent) || 0,
                totalGrossWeight: parseFloat(document.getElementById('summary-total-weight-kg').textContent) || 0,
            }
        };
    }

    // =================================================================
    // 7. Customer References
    // =================================================================
    const refInputId = isDocument ? 'shipment-reference-doc' : 'shipment-reference-pkg';
    const shipmentReference = getVal(refInputId);
    if (shipmentReference) {
        payload.customerReferences = [{
            typeCode: "CU",
            value: shipmentReference
        }];
    }

    // =================================================================
    // 8. Packages (Pieces)
    // =================================================================
    document.querySelectorAll('#package-pieces-container .package-piece-item').forEach(piece => {
        const quantity = parseInt(piece.querySelector('.piece-quantity').value, 10) || 1;
        const packageData = {
            weight: parseFloat(piece.querySelector('.piece-weight').value),
            dimensions: {
                length: parseFloat(piece.querySelector('.piece-length').value),
                width: parseFloat(piece.querySelector('.piece-width').value),
                height: parseFloat(piece.querySelector('.piece-height').value),
            }
        };
        // Add the package object 'quantity' times
        for (let i = 0; i < quantity; i++) {
            payload.content.packages.push(packageData);
        }
    });

    // =================================================================
    // 9. Document Images & Value Added Services
    // =================================================================
    const docUploader = document.getElementById('doc-uploader');
    if (getChecked('upload-documents-checkbox') && docUploader.files.length > 0) {
        const file = docUploader.files[0];
        const fileExtension = file.name.split('.').pop().toUpperCase();
        
        try {
            const base64Content = await fileToBase64(file);
            payload.documentImages = [{
                typeCode: "INV",
                imageFormat: fileExtension === 'JPG' ? 'JPEG' : fileExtension,
                content: base64Content,
            }];
            // Add WY service code when document is uploaded
            payload.valueAddedServices = [{ serviceCode: "WY" }];
        } catch (error) {
            console.error("Error encoding file to Base64:", error);
            // Optionally, show an error message to the user
            alert("Could not process the uploaded file. Please try again.");
            return null; // Return null to indicate failure
        }
    }
    
    // =================================================================
    // 10. Pickup Information
    // =================================================================
    if (getChecked('pickup-yes-btn')) {
        const sliderValues = timeSlider.get(); // ['12:15 pm', '3:15 pm']
        const closeTimeRaw = sliderValues[1]; // '3:15 pm'
        const [time, period] = closeTimeRaw.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period.toLowerCase() === 'pm' && hours !== 12) {
            hours += 12;
        }
        if (period.toLowerCase() === 'am' && hours === 12) {
            hours = 0;
        }

        payload.pickup = {
            isRequested: true,
            closeTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            location: getVal('pickup-location-select'),
            specialInstructions: [{
                value: getVal('pickup-instructions')
            }],
            pickupDetails: {
                postalAddress: {
                    postalCode: getVal('pickup-postalcode'),
                    cityName: getVal('pickup-city'),
                    countryCode: getVal('shipper-country-value'), // Assuming pickup country is same as shipper
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
        payload.pickup = { isRequested: false };
    }
    
    // =================================================================
    // 11. Output Image Properties (Invoice Generation)
    // =================================================================
    if (isPackage) {
        payload.outputImageProperties = {
            imageOptions: [{
                typeCode: "invoice",
                invoiceType: "commercial",
                isRequested: getChecked('create-invoice-btn'),
            }]
        };
    }

    return { shipment: payload };
}
