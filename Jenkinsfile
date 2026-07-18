// =========================================================================
// Jenkinsfile — End-to-End CI/CD for a React app -> Docker -> EKS
// Stages: Checkout, Clean, Install, Test, Build, SonarQube, Quality Gate,
//         Docker Build, Trivy Scan, Docker Push, AWS/EKS connect,
//         K8s Deploy, Verify Rollout, Health Check
// =========================================================================

pipeline {
    agent {
        node {
            label ''
            customWorkspace 'C:\\jenkins-ws\\react-cicd'
        }
    }

    // ---- Tools configured in Jenkins Global Tool Configuration ----
    tools {
        nodejs 'node18'   // Manage Jenkins -> Tools -> NodeJS installations, name it "node18"
    }

    // ---- Parameters you can override per-build ----
    parameters {
        string(name: 'IMAGE_TAG', defaultValue: "${env.BUILD_NUMBER}", description: 'Docker image tag')
        booleanParam(name: 'SKIP_TRIVY_BLOCK', defaultValue: false, description: 'If true, Trivy HIGH/CRITICAL findings will not fail the build')
    }

    // ---- Global environment variables ----
    environment {
        // Docker Hub
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')       // Jenkins credential ID (username/password or token)
        DOCKER_IMAGE          = "yourdockerhubuser/react-cicd-app"
        IMAGE_FULL_NAME        = "${DOCKER_IMAGE}:${params.IMAGE_TAG}"

        // SonarQube
        SONAR_PROJECT_KEY     = "react-cicd-app"

        // AWS / EKS
        AWS_REGION             = "us-east-1"
        EKS_CLUSTER_NAME        = "react-app-eks-cluster"
        AWS_CREDENTIALS_ID       = "aws-jenkins-creds"                // Jenkins credential ID (Access Key/Secret)

        // Kubernetes
        K8S_NAMESPACE          = "react-app"
        DEPLOYMENT_NAME         = "react-app-deployment"
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '15'))
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
    }

    stages {

        // ---------------- Stage 1: Checkout ----------------
        stage('Checkout Source Code') {
            steps {
                echo "Checking out source from GitHub..."
                checkout scm
                // If not using multibranch/SCM-linked job, use instead:
                // git branch: 'main', url: 'https://github.com/yourorg/your-react-repo.git', credentialsId: 'github-creds'
            }
        }

        // ---------------- Stage 2: Clean Workspace ----------------
        stage('Clean Workspace') {
            steps {
                echo "Cleaning old build artifacts..."
                sh '''
                    rm -rf node_modules build coverage
                    npm cache verify || true
                '''
            }
        }

        // ---------------- Stage 3: Install Dependencies ----------------
        stage('Install Dependencies') {
            steps {
                echo "Installing dependencies with npm ci..."
                sh 'npm ci'
            }
        }

        // ---------------- Stage 4: Unit Testing ----------------
        stage('Unit Testing') {
            steps {
                echo "Running unit tests with coverage..."
                sh 'CI=true npm test -- --coverage --watchAll=false'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: '**/junit.xml'
                }
            }
        }

        // ---------------- Stage 5: Build React Application ----------------
        stage('Build React Application') {
            steps {
                echo "Building production bundle..."
                sh 'npm run build'
            }
        }

        // ---------------- Stage 6: SonarQube Code Scan ----------------
        stage('SonarQube Code Scan') {
            steps {
                echo "Running SonarQube static analysis..."
                withSonarQubeEnv('MySonarQubeServer') { // Name configured in Manage Jenkins -> System -> SonarQube servers
                    sh """
                        sonar-scanner \
                          -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                          -Dsonar.sources=src \
                          -Dsonar.exclusions=**/*.test.js,**/node_modules/** \
                          -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                          -Dsonar.host.url=$SONAR_HOST_URL \
                          -Dsonar.login=$SONAR_AUTH_TOKEN
                    """
                }
            }
        }

        // ---------------- Stage 7: Quality Gate ----------------
        stage('Quality Gate') {
            steps {
                echo "Waiting for SonarQube Quality Gate result..."
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ---------------- Stage 8: Docker Build ----------------
        stage('Docker Build') {
            steps {
                echo "Building Docker image ${IMAGE_FULL_NAME}..."
                sh "docker build -t ${IMAGE_FULL_NAME} ."
            }
        }

        // ---------------- Stage 9: Trivy Image Scan ----------------
        stage('Trivy Image Scan') {
            steps {
                echo "Scanning image for vulnerabilities with Trivy..."
                sh """
                    trivy image --exit-code 0 --severity LOW,MEDIUM --format table ${IMAGE_FULL_NAME} > trivy-report-low-medium.txt

                    trivy image --exit-code ${params.SKIP_TRIVY_BLOCK ? '0' : '1'} \
                        --severity HIGH,CRITICAL \
                        --format table \
                        ${IMAGE_FULL_NAME} | tee trivy-report-high-critical.txt
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'trivy-report-*.txt', allowEmptyArchive: true
                }
            }
        }

        // ---------------- Stage 10: Docker Push ----------------
        stage('Docker Push') {
            steps {
                echo "Pushing image to Docker Hub..."
                sh """
                    echo "${DOCKERHUB_CREDENTIALS_PSW}" | docker login -u "${DOCKERHUB_CREDENTIALS_USR}" --password-stdin
                    docker push ${IMAGE_FULL_NAME}
                    docker tag ${IMAGE_FULL_NAME} ${DOCKER_IMAGE}:latest
                    docker push ${DOCKER_IMAGE}:latest
                """
            }
        }

        // ---------------- Stage 11: Configure AWS CLI / Connect to EKS ----------------
        stage('Connect to Amazon EKS') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: "${AWS_CREDENTIALS_ID}"
                ]]) {
                    sh """
                        aws sts get-caller-identity
                        aws eks update-kubeconfig --region ${AWS_REGION} --name ${EKS_CLUSTER_NAME}
                        kubectl get nodes
                    """
                }
            }
        }

        // ---------------- Stage 12: Deploy using Kubernetes Manifests ----------------
        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: "${AWS_CREDENTIALS_ID}"
                ]]) {
                    sh """
                        kubectl apply -f k8s/namespace.yaml
                        sed -i 's|IMAGE_PLACEHOLDER|${IMAGE_FULL_NAME}|g' k8s/deployment.yaml
                        kubectl apply -f k8s/deployment.yaml -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/service.yaml -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/ingress.yaml -n ${K8S_NAMESPACE} || true
                    """
                }
            }
        }

        // ---------------- Stage 13: Verify Rollout ----------------
        stage('Verify Rollout') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: "${AWS_CREDENTIALS_ID}"
                ]]) {
                    sh """
                        kubectl rollout status deployment/${DEPLOYMENT_NAME} -n ${K8S_NAMESPACE} --timeout=180s
                        kubectl get pods -n ${K8S_NAMESPACE} -o wide
                    """
                }
            }
        }

        // ---------------- Stage 14: Health Check ----------------
        stage('Health Check') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: "${AWS_CREDENTIALS_ID}"
                ]]) {
                    sh """
                        SVC_HOST=\$(kubectl get svc react-app-service -n ${K8S_NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
                        echo "Service endpoint: http://\$SVC_HOST"
                        for i in \$(seq 1 10); do
                          if curl -sSf "http://\$SVC_HOST" -o /dev/null; then
                            echo "Health check passed."
                            exit 0
                          fi
                          echo "Waiting for LB to become healthy... (\$i/10)"
                          sleep 15
                        done
                        echo "Health check failed after retries."
                        exit 1
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline completed successfully — image ${IMAGE_FULL_NAME} deployed to EKS."
        }
        failure {
            echo "❌ Pipeline failed. Check stage logs and archived Trivy/Sonar reports."
        }
        always {
            sh 'docker logout || true'
            cleanWs()
        }
    }
}
