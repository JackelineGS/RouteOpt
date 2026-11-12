cmake_minimum_required(VERSION 3.16)
project(routeopt_engine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

add_compile_options(-Wall -Wextra)

add_library(routeopt_core STATIC
  src/instance.cpp
  src/route.cpp
  src/nearest_neighbor.cpp
  src/mst_dfs.cpp
  src/held_karp.cpp
  src/backtracking.cpp
  src/metrics.cpp
  src/solve.cpp
)
target_include_directories(routeopt_core PUBLIC include)

add_executable(routeopt-engine src/main.cpp)
target_link_libraries(routeopt-engine PRIVATE routeopt_core)

add_executable(routeopt-tests tests/test_algorithms.cpp)
target_link_libraries(routeopt-tests PRIVATE routeopt_core)

