``` 
--------------------------------------------------------
   NOTE:  THIS FILE IS NOT FORAI MODEL Consumption
--------------------------------------------------------
```

# MASTER PLAN NOTES for OPUZEN API

## Phase I
### OPMS API --> NetSuite Todo List
- Get the OPMS --> NetSuite Sync working properly
- Get the NetSuite --> OPMS Sync working properly


## Phase II
### OPMS API Todo List
- Update the database tables from OPMS for the API 
- Adjust the API added table accordingly
- pull the latestOPMS code into the API code base
- Main spec must work with legacy data tables 
- FORBIDEN to change legacy database:
  - Allowed to create new tables while keeping the old working

- create an AI Model Spec for the OPMS API Product --> items
- create an AI Model Spec for the OPMS API web vis requirements

### OPMS Front End Todo List
- Redesign the Products Page 
  - CRUD Form 
    - (parent level common data)
    - Prod level web visibitly

  - Each Product pop-open to reviewl list of Items (colorways).
    - Each Colorway 
    - CRDU Form
    - Item level web visibilty
      - based on Parent web vis & product status
