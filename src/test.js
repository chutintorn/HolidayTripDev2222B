curl --location 'https://uat-ota.nokair.com/v1/submit-hold-booking' \
--header 'X-Correlation-Id: 46e9a1a0-eab2-40d3-8d2a-5abecff8fad7' \
--header 'client_id: a4c25cd4d08a4a6ba25e8f3d87e45fe9' \
--header 'client_secret: EaC22225D635456685833765FA8B277D' \
--header 'Content-Type: application/json' \
--header 'security-token: 48e2b0efh4f6oab8u2l4b565x5ea15524d298ea33ff7' \
--data-raw '{
    "agencyCode": "",
    
    "actionType": "create",
    "passengerInfos": [
        {
            "paxNumber": 1,
            "title": "MR",
            "firstName": "NOKNOI",
            "lastName": "Test",
            "middleName": "",
            "age": 36,
            "dateOfBirth": "1987-12-30",
            "passengerType": "Adult",
            "mobilePhone": "+66916548569",
            "email": "cancelgo25@gmail.com",
            "gender": "Male",
            "passportNumber": "AA1234567",
            "expirationDate": "2026-01-30",
            "nationality": "TH",
            "issueCountry": "TH",
            "flightFareKey": [
                {
                    "fareKey": "DMKCNX20240828010000THB_10:URALIT00",
                    "journeyKey": "DMKCNX20240828010000THB_DD12020240828",
                    "extraService": [
                        
                        
                        
                        
                    ],
                    "selectedSeat": [
                        
                        
                        
                        
                        
                    ]
                }
            ]
        }
    ]
}'