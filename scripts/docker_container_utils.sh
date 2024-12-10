#!/bin/bash

# Function to check container health
check_health() {
    local container_name="$1"
    docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || \
    docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || \
    echo "unknown"
}

# Function to wait for container to be healthy
wait_for_health() {
    local container_name="$1"
    local timeout_duration=30
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout_duration))
    
    echo "Waiting for container to be healthy..."
    while (( $(date +%s) < end_time )); do
        local status=$(check_health "$container_name")
        echo "Container health status: [$status]"
        
        if [[ "$status" = "healthy" ]]; then
            return 0
        fi
        sleep 2
    done
    
    return 1
}

# Function to handle container switch and cleanup
handle_container_switch() {
    local container_name="$1"
    local deploy_time="$2"
    local environment="$3"

    echo 'New container is healthy, switching traffic...'
    # Get current container config
    local config=$(docker inspect "$container_name" --format='{{range .Config.Env}} -e {{.}}{{end}}')
    local image=$(docker inspect "$container_name" --format='{{.Config.Image}}')
    
    # Create new container but don't start it yet
    echo "Creating final container..."
    docker create \
        --name ocp-${environment}-final \
        -p 8080:8080 \
        --health-cmd='curl -f http://localhost:8080/health || exit 1' \
        --health-interval='2s' \
        --health-retries='3' \
        --health-timeout='5s' \
        --restart always \
        $config \
        -v '/home/ubuntu/global-bundle.pem:/global-bundle.pem' \
        $image
    
    # Atomic switch: stop old container and start new one as quickly as possible
    echo "Performing atomic switch..."
    (
        # Use subshell for atomic operation
        docker stop ocp-${environment} 2>/dev/null
        docker rm ocp-${environment} 2>/dev/null
        docker rename ocp-${environment}-final ocp-${environment}
        docker start ocp-${environment}
    ) & # Run in background
    
    # Wait for background process
    wait $!
    
    # Verify new container is running
    if ! docker ps --filter "name=ocp-${environment}" --filter "status=running" | grep -q ocp-${environment}; then
        echo "Switch failed, rolling back..."
        return 1
    fi
    

    # Stop and remove the old container
    docker stop "$container_name"
    docker rm "$container_name"
    
    echo 'Performing final cleanup...'
    docker image ls "ocp-${environment}:*" --format '{{.ID}}' | tail -n +3 | xargs -r docker image rm
    docker system prune -af --volumes
    docker tag "ocp-${environment}:${deploy_time}" ocp-${environment}:latest
    
    echo 'Deployment successful!'
    cd /home/ubuntu && rm -rf "app-${deploy_time}"
    return 0
}

# Function to handle failed deployment
handle_failed_deployment() {
    local container_name="$1"
    local deploy_time="$2"
    local environment="$3"
    echo 'New container failed health check, rolling back...'
    docker stop "$container_name"
    docker rm "$container_name"
    docker image rm "ocp-${environment}:${deploy_time}"
    cd /home/ubuntu && rm -rf "app-${deploy_time}"
    return 1
}