# AWS CloudFormation Notes

## Parameters


## Order of CloudFormation Template Execution

__Descrption:__  This is the order in which to use CloudFormation Templates to set up the ALB


1. Aplication Load Balancer (ALB)
   - Template file: cloudform-[APP]-ALB-[ENV]-[YYYYMMDD].yaml
     - eg. cloudform-OPMS-ALB--DEV_20240826.yaml
   - Creates: Aplication Load Balancer

2. __Launch Template(s)__ 
    - Template file(s): cloudForm-[APP]-LaunchTemp-[ENV]-[YYYYMMDD].yaml
      - eg. 
        - cloudForm-OPMS-LaunchTemp-DEV_20240826.yaml
        - cloudForm-OPMS-LaunchTemp-QA_20240826.yaml
        - cloudForm-OPMS-LaunchTemp-PROD_20240826.yaml
    - Creates: Launch Template
       - Also loads template _user data_ scripts from S3://user-data/LaunchTemplateUserData-[spec-name].sh

3. __Target Groups for each Workflow Environment__
    - Template file(s): cloudForm-[APP]-TargetGrp-[ENV]-[YYYYMMDD].yaml
      - eg. 
        - cloudForm-OPMS-TargetGrp-DEV_20240826.yaml
        - cloudForm-OPMS-TargetGrp-QA_20240826.yaml
        - cloudForm-OPMS-TargetGrp-PROD_20240826.yaml

3. __Listen-Rules, Listener(s), TargetGroup, Auto Scaling Group__ 
    - Creates: Rules & Listener(s) for routing, Target Group, and AutoScaling Group
    - Template file: cloudform-[APP]-Listener-TargetGrp-ASG-[YYYYMMDD].yaml
       - eg. cloudform-OPMS-Rules-Listener-TargetGrp-ASG-20240903.yaml 
    - Params (from previous templates): 
       - Needs ALB's ARN, 
       - Each individual Launchtemplate ID
       - Each individual Target Group ARN
  


# Subsequent Workflows (like QA and Production) in the same ALB ...

__Descrption:__  The above stated the configuration for the DEV environment within the ALB (step 3). Subsequent environments such as QA and Produciton can be added by repeating steps 1 and 2 with appropriate configuration adjustments.

eg.

 - cloudForm-OPMS-LaunchTemp-QA_20240906.yaml
 - cloudform-OPMS-Listener-TargetGrp-QA_20240906.yaml
