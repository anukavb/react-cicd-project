# Copy this file to terraform.tfvars and adjust as needed:
#   cp terraform.tfvars.example terraform.tfvars

aws_region      = "ap-south-1"
project_name    = "react-app"
cluster_name    = "react-app-eks-cluster"
cluster_version = "1.30"

vpc_cidr              = "10.0.0.0/16"
azs                   = ["ap-south-1a", "ap-south-1b"]
public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24"]

node_instance_types = ["t3.micro"]
node_desired_size   = 2
node_min_size       = 2
node_max_size       = 4
